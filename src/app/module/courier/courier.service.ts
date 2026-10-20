import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	AssignmentStatus,
	AttemptStatus,
	CourierAvailability,
	PaymentStatus,
	ShipmentStatus,
	TransferStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICompleteDeliveryPayload,
	ICourierTaskQuery,
	IDeliverToHubPayload,
	IDeliveryFailedPayload,
	IPickupShipmentPayload,
	IRejectAssignmentPayload,
	IReschedulePayload,
	IReturnedPayload,
	IStartDeliveryPayload,
} from "./courier.interface";

/**
 * Retrieve courier profile associated with user ID
 */
const getCourierByUserId = async (userId: string) => {
	const courier = await prisma.courier.findUnique({
		where: { userId },
		include: {
			hub: true,
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					phone: true,
				},
			},
		},
	});

	if (!courier) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Courier profile not found for this user account.",
		);
	}

	return courier;
};

/**
 * Get all delivery or pickup tasks assigned to this courier
 */
const getMyTasks = async (userId: string, query: ICourierTaskQuery) => {
	const courier = await getCourierByUserId(userId);

	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.CourierParcelWhereInput = {
		courierId: courier.id,
	};

	if (query.status) {
		whereConditions.status = query.status;
	}

	const shipmentWhere: Prisma.ShipmentWhereInput = {};

	if (query.shipmentStatus) {
		shipmentWhere.status = query.shipmentStatus;
	}

	if (query.searchTerm) {
		shipmentWhere.OR = [
			{
				trackingNumber: {
					contains: query.searchTerm,
					mode: "insensitive",
				},
			},
			{
				description: {
					contains: query.searchTerm,
					mode: "insensitive",
				},
			},
		];
	}

	if (Object.keys(shipmentWhere).length > 0) {
		whereConditions.shipment = {
			is: shipmentWhere,
		};
	}

	const sortBy = query.sortBy || "assignedAt";
	const sortOrder = query.sortOrder || "desc";

	const [tasks, total] = await Promise.all([
		prisma.courierParcel.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				shipment: {
					include: {
						pickupAddress: true,
						deliveryAddress: true,
						originHub: true,
						destinationHub: true,
						customer: {
							include: {
								user: {
									select: {
										id: true,
										name: true,
										phone: true,
										email: true,
									},
								},
							},
						},
					},
				},
			},
		}),
		prisma.courierParcel.count({
			where: whereConditions,
		}),
	]);

	return {
		data: tasks,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

/**
 * Get a single task assignment by ID
 */
const getTaskById = async (userId: string, assignmentId: string) => {
	const courier = await getCourierByUserId(userId);

	const task = await prisma.courierParcel.findUnique({
		where: { id: assignmentId },
		include: {
			shipment: {
				include: {
					pickupAddress: true,
					deliveryAddress: true,
					originHub: true,
					destinationHub: true,
					statusHistory: {
						orderBy: {
							createdAt: "asc",
						},
					},
					deliveryAttempts: {
						include: {
							proofOfDelivery: true,
						},
						orderBy: {
							attemptedAt: "asc",
						},
					},
					payment: true,
					customer: {
						include: {
							user: {
								select: {
									id: true,
									name: true,
									phone: true,
									email: true,
								},
							},
						},
					},
				},
			},
		},
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Assignment task not found.");
	}

	if (task.courierId !== courier.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not authorized to view this assignment.",
		);
	}

	return task;
};

/**
 * Courier accepts an assigned shipment task
 */
const acceptAssignment = async (userId: string, assignmentId: string) => {
	const courier = await getCourierByUserId(userId);

	const assignment = await prisma.courierParcel.findUnique({
		where: { id: assignmentId },
		include: { shipment: true },
	});

	if (!assignment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assignment task not found.");
	}

	if (assignment.courierId !== courier.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You cannot accept an assignment that is not assigned to you.",
		);
	}

	if (assignment.status !== AssignmentStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Assignment is currently in '${assignment.status}' state and cannot be accepted.`,
		);
	}

	const updatedAssignment = await prisma.$transaction(async (tx) => {
		const updated = await tx.courierParcel.update({
			where: { id: assignmentId },
			data: {
				status: AssignmentStatus.ACCEPTED,
				acceptedAt: new Date(),
			},
			include: {
				shipment: true,
			},
		});

		// If the shipment is in COURIER_ASSIGNED status, update to PICKUP_ASSIGNED
		if (assignment.shipment.status === ShipmentStatus.COURIER_ASSIGNED) {
			await tx.shipment.update({
				where: { id: assignment.shipmentId },
				data: {
					status: ShipmentStatus.PICKUP_ASSIGNED,
				},
			});
		}

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId: assignment.shipmentId,
				status:
					assignment.shipment.status === ShipmentStatus.COURIER_ASSIGNED
						? ShipmentStatus.PICKUP_ASSIGNED
						: assignment.shipment.status,
				location: courier.hub?.name || "Assigned Hub",
				note: `Courier rider ${courier.user.name} accepted the task assignment.`,
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedAssignment;
};

/**
 * Courier rejects an assigned shipment task
 */
const rejectAssignment = async (
	userId: string,
	assignmentId: string,
	payload: IRejectAssignmentPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const assignment = await prisma.courierParcel.findUnique({
		where: { id: assignmentId },
		include: { shipment: true },
	});

	if (!assignment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assignment task not found.");
	}

	if (assignment.courierId !== courier.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You cannot reject an assignment that is not assigned to you.",
		);
	}

	if (assignment.status !== AssignmentStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Assignment is currently in '${assignment.status}' state and cannot be rejected.`,
		);
	}

	const updatedAssignment = await prisma.$transaction(async (tx) => {
		const updated = await tx.courierParcel.update({
			where: { id: assignmentId },
			data: {
				status: AssignmentStatus.REJECTED,
			},
		});

		// Revert shipment back to appropriate stage so Operations Manager can reassign
		const revertStatus =
			assignment.shipment.status === ShipmentStatus.IN_TRANSIT
				? ShipmentStatus.AT_ORIGIN_HUB
				: assignment.shipment.status === ShipmentStatus.OUT_FOR_DELIVERY
					? ShipmentStatus.AT_DESTINATION_HUB
					: ShipmentStatus.PENDING_APPROVAL;

		await tx.shipment.update({
			where: { id: assignment.shipmentId },
			data: {
				status: revertStatus,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId: assignment.shipmentId,
				status: revertStatus,
				location: courier.hub?.name || "Hub Area",
				note: `Courier rider ${courier.user.name} rejected assignment: ${payload.reason || "No reason provided"}. Returned to ${revertStatus}.`,
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedAssignment;
};

/**
 * Courier confirms pickup of parcel from sender -> moves status to PICKED_UP
 */
const pickupShipment = async (
	userId: string,
	shipmentId: string,
	payload: IPickupShipmentPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { pickupAddress: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.COURIER_ASSIGNED &&
		shipment.status !== ShipmentStatus.PICKUP_ASSIGNED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment cannot be marked as picked up while in '${shipment.status}' status.`,
		);
	}

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.PICKED_UP,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.PICKED_UP,
				location: shipment.pickupAddress?.area || "Pickup Location",
				note:
					payload.note ||
					`Parcel picked up by courier rider ${courier.user.name}`,
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedShipment;
};

/**
 * Courier delivers parcel to Origin Hub (pickup drop-off) or Destination Hub (transit drop-off)
 */
const deliverToOriginHub = async (
	userId: string,
	shipmentId: string,
	payload: IDeliverToHubPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { originHub: true, destinationHub: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.PICKED_UP &&
		shipment.status !== ShipmentStatus.IN_TRANSIT
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment must be in 'PICKED_UP' or 'IN_TRANSIT' status before checking in at a Hub (current: '${shipment.status}').`,
		);
	}

	const isTransitDropoff = shipment.status === ShipmentStatus.IN_TRANSIT;
	const targetStatus = isTransitDropoff
		? ShipmentStatus.AT_DESTINATION_HUB
		: ShipmentStatus.AT_ORIGIN_HUB;

	const targetHub = isTransitDropoff
		? shipment.destinationHub
		: shipment.originHub;

	const targetHubName =
		targetHub?.name || (isTransitDropoff ? "Destination Hub" : "Origin Hub");

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: targetStatus,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
			},
		});

		// Mark active pickup or transit courier assignment as COMPLETED
		await tx.courierParcel.updateMany({
			where: {
				shipmentId,
				courierId: courier.id,
				status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
			},
			data: {
				status: AssignmentStatus.COMPLETED,
				completedAt: new Date(),
			},
		});

		// If this was an inter-hub transfer, update transfer status to RECEIVED
		if (isTransitDropoff) {
			await tx.hubTransfer.updateMany({
				where: {
					shipmentId,
					status: {
						in: [
							TransferStatus.PENDING,
							TransferStatus.DISPATCHED,
							TransferStatus.IN_TRANSIT,
						],
					},
				},
				data: {
					status: TransferStatus.RECEIVED,
					receivedAt: new Date(),
				},
			});
		}

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: targetStatus,
				location: targetHubName,
				note:
					payload.note ||
					(isTransitDropoff
						? `Parcel arrived and checked in at Destination Hub (${targetHubName}) by transit driver ${courier.user.name}`
						: `Parcel dropped off and checked in at Origin Hub (${targetHubName}) by ${courier.user.name}`),
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedShipment;
};

/**
 * Courier starts delivery run -> moves status to OUT_FOR_DELIVERY
 */
const startDelivery = async (
	userId: string,
	shipmentId: string,
	payload: IStartDeliveryPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { destinationHub: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	const allowableStatuses: ShipmentStatus[] = [
		ShipmentStatus.AT_DESTINATION_HUB,
		ShipmentStatus.AT_ORIGIN_HUB,
		ShipmentStatus.RESCHEDULED,
	];

	if (!allowableStatuses.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment cannot be moved to OUT_FOR_DELIVERY from status '${shipment.status}'.`,
		);
	}

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const deliveryOtp =
			shipment.deliveryOtp ||
			Math.floor(100000 + Math.random() * 900000).toString();

		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.OUT_FOR_DELIVERY,
				deliveryOtp,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
			},
		});

		// Ensure assignment status is accepted
		await tx.courierParcel.updateMany({
			where: {
				shipmentId,
				courierId: courier.id,
				status: AssignmentStatus.PENDING,
			},
			data: {
				status: AssignmentStatus.ACCEPTED,
				acceptedAt: new Date(),
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.OUT_FOR_DELIVERY,
				location: shipment.destinationHub?.name || "Delivery Zone",
				note:
					payload.note ||
					`Parcel is out for delivery with courier ${courier.user.name}`,
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedShipment;
};

/**
 * Courier completes delivery -> creates Proof of Delivery and records Payment
 */
const completeDelivery = async (
	userId: string,
	shipmentId: string,
	payload: ICompleteDeliveryPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { deliveryAddress: true, payment: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.OUT_FOR_DELIVERY &&
		shipment.status !== ShipmentStatus.RESCHEDULED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment must be in 'OUT_FOR_DELIVERY' status to be marked delivered (current: '${shipment.status}').`,
		);
	}

	// Verify Delivery OTP provided by receiver
	if (shipment.deliveryOtp) {
		if (!payload.otp || shipment.deliveryOtp.trim() !== payload.otp.trim()) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Invalid delivery OTP provided by receiver. Handover cannot be completed without the correct security OTP.",
			);
		}
	}

	const result = await prisma.$transaction(async (tx) => {
		// 1. Calculate attempt count
		const previousAttempts = await tx.deliveryAttempt.count({
			where: { shipmentId },
		});
		const attemptNumber = previousAttempts + 1;

		// 2. Create successful DeliveryAttempt
		const deliveryAttempt = await tx.deliveryAttempt.create({
			data: {
				shipmentId,
				courierId: courier.id,
				attemptNumber,
				status: AttemptStatus.SUCCESS,
				notes: payload.notes || "Delivered successfully with receiver OTP",
				attemptedAt: new Date(),
			},
		});

		// 3. Create ProofOfDelivery
		const pod = await tx.proofOfDelivery.create({
			data: {
				shipmentId,
				deliveryAttemptId: deliveryAttempt.id,
				recipientName: payload.recipientName,
				recipientPhone: payload.recipientPhone,
				imageUrl: payload.imageUrl || null,
				signatureUrl: payload.signatureUrl || null,
				notes: payload.notes || null,
			},
		});

		// 4. Update or create Payment record if collected or COD
		if (
			payload.paymentCollected ||
			shipment.paymentStatus === PaymentStatus.PENDING
		) {
			if (shipment.payment) {
				await tx.payment.update({
					where: { id: shipment.payment.id },
					data: {
						status: PaymentStatus.PAID,
						paidAt: new Date(),
						provider: payload.paymentMethod || shipment.payment.provider,
						transactionId:
							payload.transactionId || shipment.payment.transactionId,
					},
				});
			} else {
				await tx.payment.create({
					data: {
						shipmentId,
						amount: shipment.deliveryCharge,
						provider: payload.paymentMethod || "CASH_ON_DELIVERY",
						status: PaymentStatus.PAID,
						paidAt: new Date(),
						transactionId: payload.transactionId || null,
					},
				});
			}
		}

		// 5. Complete courier assignment
		await tx.courierParcel.updateMany({
			where: {
				shipmentId,
				courierId: courier.id,
				status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
			},
			data: {
				status: AssignmentStatus.COMPLETED,
				completedAt: new Date(),
			},
		});

		// 6. Update Shipment payment status (courier completed assignment; operations manager will mark DELIVERED)
		const updatedShipment = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				paymentStatus:
					payload.paymentCollected ||
					shipment.paymentStatus === PaymentStatus.PENDING
						? PaymentStatus.PAID
						: shipment.paymentStatus,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				proofOfDelivery: true,
				payment: true,
			},
		});

		// 7. Status History
		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.OUT_FOR_DELIVERY,
				location: shipment.deliveryAddress?.area || "Destination Address",
				note: `Courier ${courier.user.name} completed handover to ${payload.recipientName} with receiver OTP verification. Courier assignment marked COMPLETED. Awaiting Operations Manager final delivery sign-off.`,
				updatedBy: userId,
			},
		});

		return {
			shipment: updatedShipment,
			proofOfDelivery: pod,
			attempt: deliveryAttempt,
		};
	});

	return result;
};

/**
 * Delivery attempt failed -> creates failed DeliveryAttempt and updates status to DELIVERY_FAILED
 */
const recordDeliveryFailed = async (
	userId: string,
	shipmentId: string,
	payload: IDeliveryFailedPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { deliveryAddress: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.OUT_FOR_DELIVERY &&
		shipment.status !== ShipmentStatus.RESCHEDULED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Delivery failure can only be recorded when shipment is OUT_FOR_DELIVERY (current: '${shipment.status}').`,
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const previousAttempts = await tx.deliveryAttempt.count({
			where: { shipmentId },
		});
		const attemptNumber = previousAttempts + 1;

		const failedAttempt = await tx.deliveryAttempt.create({
			data: {
				shipmentId,
				courierId: courier.id,
				attemptNumber,
				status: AttemptStatus.FAILED,
				failureReason: payload.failureReason,
				notes: payload.notes || null,
				attemptedAt: new Date(),
			},
		});

		const updatedShipment = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.DELIVERY_FAILED,
			},
			include: {
				deliveryAddress: true,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.DELIVERY_FAILED,
				location: shipment.deliveryAddress?.area || "Delivery Zone",
				note: `Delivery attempt #${attemptNumber} failed: ${payload.failureReason}`,
				updatedBy: userId,
			},
		});

		return {
			shipment: updatedShipment,
			attempt: failedAttempt,
		};
	});

	return result;
};

/**
 * Reschedule shipment for next delivery attempt -> moves status to RESCHEDULED
 */
const rescheduleDelivery = async (
	userId: string,
	shipmentId: string,
	payload: IReschedulePayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.DELIVERY_FAILED &&
		shipment.status !== ShipmentStatus.OUT_FOR_DELIVERY
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment cannot be rescheduled from status '${shipment.status}'.`,
		);
	}

	const scheduledDate = new Date(payload.scheduledAt);

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.RESCHEDULED,
				scheduledPickupAt: scheduledDate,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.RESCHEDULED,
				note: `Delivery rescheduled for ${scheduledDate.toISOString()}. Reason: ${payload.reason || "Customer requested alternative delivery time"} (Handled by ${courier.user.name})`,
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedShipment;
};

/**
 * Complete return of parcel to original sender -> moves status to RETURNED
 */
const returnShipment = async (
	userId: string,
	shipmentId: string,
	payload: IReturnedPayload,
) => {
	const courier = await getCourierByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { pickupAddress: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.RETURN_IN_TRANSIT &&
		shipment.status !== ShipmentStatus.RETURN_INITIATED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment must be in 'RETURN_IN_TRANSIT' or 'RETURN_INITIATED' to be marked as RETURNED (current: '${shipment.status}').`,
		);
	}

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.RETURNED,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
			},
		});

		await tx.courierParcel.updateMany({
			where: {
				shipmentId,
				courierId: courier.id,
				status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
			},
			data: {
				status: AssignmentStatus.COMPLETED,
				completedAt: new Date(),
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.RETURNED,
				location: shipment.pickupAddress?.area || "Original Sender Address",
				note: `Parcel returned to sender (${payload.recipientName || "Sender"}). Notes: ${payload.notes || "Returned successfully"} (Delivered back by ${courier.user.name})`,
				updatedBy: userId,
			},
		});

		return updated;
	});

	return updatedShipment;
};

const getMyProfile = async (userId: string) => {
	return getCourierByUserId(userId);
};

const updateAvailability = async (
	userId: string,
	availabilityStatus: CourierAvailability,
) => {
	const courier = await getCourierByUserId(userId);
	const updated = await prisma.courier.update({
		where: { id: courier.id },
		data: { availabilityStatus },
		include: {
			hub: true,
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					phone: true,
				},
			},
		},
	});

	return updated;
};

export const CourierService = {
	getMyProfile,
	updateAvailability,
	getMyTasks,
	getTaskById,
	acceptAssignment,
	rejectAssignment,
	pickupShipment,
	deliverToOriginHub,
	startDelivery,
	completeDelivery,
	recordDeliveryFailed,
	rescheduleDelivery,
	returnShipment,
};
