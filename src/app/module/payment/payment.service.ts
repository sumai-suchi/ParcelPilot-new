import httpStatus from "http-status";
import Stripe from "stripe";
import { PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IConfirmPaymentPayload,
	ICreateCheckoutSessionPayload,
	ICreatePaymentIntentPayload,
	IVerifyCheckoutSessionPayload,
} from "./payment.interface";

// Initialize official Stripe client
const stripe = new Stripe(config.stripe_secret_key || "");


/**
 * Get real-time payment status of a shipment
 */
const getPaymentStatus = async (shipmentId: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: {
			payment: true,
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	return {
		shipmentId: shipment.id,
		trackingNumber: shipment.trackingNumber,
		deliveryCharge: shipment.deliveryCharge,
		paymentStatus: shipment.paymentStatus,
		payment: shipment.payment,
	};
};

/**
 * Creates a Stripe Hosted Checkout Session for the shipment
 */
const createCheckoutSession = async (
	shipmentId: string,
	userId: string,
	payload?: ICreateCheckoutSessionPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: {
			customer: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							phone: true,
						},
					},
				},
			},
			payment: true,
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.paymentStatus === PaymentStatus.PAID) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This shipment has already been paid for.",
		);
	}

	const deliveryCharge = Number(shipment.deliveryCharge) || 100.0;
	const currency = (
		payload?.currency ||
		config.stripe_currency ||
		"bdt"
	).toLowerCase();

	const rawSubunits = Math.round(deliveryCharge * 100);
	const amountInSubunits =
		currency === "bdt" ? Math.max(rawSubunits, 10000) : Math.max(rawSubunits, 50);

	const frontendUrl = config.frontend_url || "http://localhost:3000";
	const successUrl = `${frontendUrl}/customer/shipments/${shipmentId}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${frontendUrl}/customer/shipments/${shipmentId}?payment=cancelled`;

	let session: Stripe.Checkout.Session;

	try {
		session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			line_items: [
				{
					price_data: {
						currency,
						product_data: {
							name: `Shipment Waybill: ${shipment.trackingNumber}`,
							description: `Door-to-door delivery tariff for ${shipment.parcelType} (${Number(shipment.weight).toFixed(1)} kg)`,
						},
						unit_amount: amountInSubunits,
					},
					quantity: 1,
				},
			],
			mode: "payment",
			customer_email: shipment.customer.user.email,
			client_reference_id: shipmentId,
			metadata: {
				shipmentId,
				trackingNumber: shipment.trackingNumber,
				userId,
			},
			success_url: successUrl,
			cancel_url: cancelUrl,
		});
	} catch (error: any) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Stripe Checkout Session creation failed: ${error.message}`,
		);
	}

	// Upsert local Payment record with PENDING status
	await prisma.payment.upsert({
		where: { shipmentId },
		update: {
			amount: deliveryCharge,
			currency: currency.toUpperCase(),
			provider: "STRIPE",
			transactionId: session.id,
			status: PaymentStatus.PENDING,
		},
		create: {
			shipmentId,
			amount: deliveryCharge,
			currency: currency.toUpperCase(),
			provider: "STRIPE",
			transactionId: session.id,
			status: PaymentStatus.PENDING,
		},
	});

	return {
		sessionId: session.id,
		url: session.url,
		amount: deliveryCharge,
		currency: currency.toUpperCase(),
		trackingNumber: shipment.trackingNumber,
	};
};

/**
 * Verifies a Stripe Hosted Checkout Session upon return to frontend
 */
const verifyCheckoutSession = async (
	shipmentId: string,
	sessionId: string,
	userId: string,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { payment: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	let session: Stripe.Checkout.Session;

	try {
		session = await stripe.checkout.sessions.retrieve(sessionId);
	} catch (error: any) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			`Failed to retrieve Checkout Session from Stripe: ${error.message}`,
		);
	}

	if (session.payment_status === "paid") {
		const transactionId =
			typeof session.payment_intent === "string"
				? session.payment_intent
				: session.id;

		const result = await prisma.$transaction(async (tx) => {
			const updatedPayment = await tx.payment.upsert({
				where: { shipmentId },
				update: {
					status: PaymentStatus.PAID,
					paidAt: new Date(),
					transactionId,
					provider: "STRIPE",
				},
				create: {
					shipmentId,
					amount: Number(shipment.deliveryCharge),
					currency: (session.currency || "bdt").toUpperCase(),
					status: PaymentStatus.PAID,
					paidAt: new Date(),
					transactionId,
					provider: "STRIPE",
				},
			});

			const updatedShipment = await tx.shipment.update({
				where: { id: shipmentId },
				data: {
					paymentStatus: PaymentStatus.PAID,
				},
				include: {
					payment: true,
					pickupAddress: true,
					deliveryAddress: true,
				},
			});

			await tx.shipmentStatusHistory.create({
				data: {
					shipmentId,
					status: shipment.status,
					note: `Payment of ৳${shipment.deliveryCharge} completed successfully via Stripe Hosted Checkout (Session: ${session.id}).`,
					updatedBy: userId,
				},
			});

			return {
				shipment: updatedShipment,
				payment: updatedPayment,
			};
		});

		return {
			paid: true,
			status: "PAID",
			transactionId,
			shipment: result.shipment,
		};
	}

	return {
		paid: false,
		status: session.payment_status,
		sessionId: session.id,
	};
};

/**
 * Handle Stripe webhook events for automated reconciliation
 */
const handleWebhook = async (signature: string, payload: Buffer) => {
	if (!config.stripe_webhook_secret) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Stripe webhook secret is not configured.",
		);
	}

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			payload,
			signature,
			config.stripe_webhook_secret,
		);
	} catch (error: any) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Webhook signature verification failed: ${error.message}`,
		);
	}

	if (event.type === "payment_intent.succeeded") {
		const paymentIntent = event.data.object as Stripe.PaymentIntent;
		const shipmentId = paymentIntent.metadata?.shipmentId;

		if (shipmentId) {
			await prisma.$transaction(async (tx) => {
				await tx.payment.upsert({
					where: { shipmentId },
					update: {
						status: PaymentStatus.PAID,
						paidAt: new Date(),
						transactionId: paymentIntent.id,
						provider: "STRIPE",
					},
					create: {
						shipmentId,
						amount: paymentIntent.amount / 100,
						currency: paymentIntent.currency.toUpperCase(),
						status: PaymentStatus.PAID,
						paidAt: new Date(),
						transactionId: paymentIntent.id,
						provider: "STRIPE",
					},
				});

				await tx.shipment.update({
					where: { id: shipmentId },
					data: {
						paymentStatus: PaymentStatus.PAID,
					},
				});
			});
		}
	} else if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		const shipmentId =
			session.metadata?.shipmentId || session.client_reference_id;

		if (shipmentId && session.payment_status === "paid") {
			const transactionId =
				typeof session.payment_intent === "string"
					? session.payment_intent
					: session.id;

			await prisma.$transaction(async (tx) => {
				await tx.payment.upsert({
					where: { shipmentId },
					update: {
						status: PaymentStatus.PAID,
						paidAt: new Date(),
						transactionId,
						provider: "STRIPE",
					},
					create: {
						shipmentId,
						amount: (session.amount_total || 0) / 100,
						currency: (session.currency || "BDT").toUpperCase(),
						status: PaymentStatus.PAID,
						paidAt: new Date(),
						transactionId,
						provider: "STRIPE",
					},
				});

				await tx.shipment.update({
					where: { id: shipmentId },
					data: {
						paymentStatus: PaymentStatus.PAID,
					},
				});
			});
		}
	}

	return { received: true };
};

export const PaymentService = {

	createCheckoutSession,
	verifyCheckoutSession,
	getPaymentStatus,
	handleWebhook,
};

