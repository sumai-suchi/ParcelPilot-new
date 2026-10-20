import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";



const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { shipmentId } = req.params;
	const result = await PaymentService.createCheckoutSession(
		shipmentId as string,
		user.userId,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Stripe Checkout Session initialized successfully.",
		data: result,
	});
});

const verifyCheckoutSession = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { shipmentId } = req.params;
	const { sessionId } = req.body;

	if (!sessionId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Stripe sessionId is required to verify checkout session.",
		);
	}

	const result = await PaymentService.verifyCheckoutSession(
		shipmentId as string,
		sessionId,
		user.userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Stripe Checkout Session verified successfully.",
		data: result,
	});
});

const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
	const { shipmentId } = req.params;
	const result = await PaymentService.getPaymentStatus(shipmentId as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment status retrieved successfully.",
		data: result,
	});
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
	const signature = req.headers["stripe-signature"] as string;
	const payload = (req as any).rawBody || req.body;
	const result = await PaymentService.handleWebhook(signature, payload);

	res.status(httpStatus.OK).json(result);
});

export const PaymentController = {
	
	createCheckoutSession,
	verifyCheckoutSession,
	getPaymentStatus,
	handleWebhook,
};

