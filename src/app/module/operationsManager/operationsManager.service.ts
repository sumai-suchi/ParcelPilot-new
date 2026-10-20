import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	AssignmentStatus,
	PaymentStatus,
	ShipmentStatus,
	TransferStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IAssignDeliveryCourierPayload,
	IAssignHubAndCourierPayload,
	ICancelShipmentPayload,
	ICourierFilterQuery,
	ICreateHubTransferPayload,
	IOperationsShipmentFilterQuery,
	IReceiveHubTransferPayload,
	IRejectShipmentPayload,
	IReturnInitiatePayload,
	IReturnInTransitPayload,
	IUpdateDeliveredPayload,
	IUpdateOutForDeliveryPayload,
} from "./operationsManager.interface";

// ==========================================
// Shipment Management Services
// ==========================================

const getAllShipments = async (query: IOperationsShipmentFilterQuery) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.ShipmentWhereInput = {};

	if (query.status) {
		whereConditions.status = query.status;
	}

	if (query.originHubId) {
		whereConditions.originHubId = query.originHubId;
	}

	if (query.destinationHubId) {
		whereConditions.destinationHubId = query.destinationHubId;
	}

	if (query.searchTerm) {
		whereConditions.OR = [
			{ trackingNumber: { contains: query.searchTerm, mode: "insensitive" } },
			{
				customer: {
					user: {
						OR: [
							{ name: { contains: query.searchTerm, mode: "insensitive" } },
							{ phone: { contains: query.searchTerm, mode: "insensitive" } },
							{ email: { contains: query.searchTerm, mode: "insensitive" } },
						],
					},
				},
			},
		];
	}

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const [shipments, total] = await Promise.all([
		prisma.shipment.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
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
				courierAssignments: {
					include: {
						courier: {
							include: {
								user: {
									select: {
										id: true,
										name: true,
										phone: true,
									},
								},
							},
						},
					},
				},
			},
		}),
		prisma.shipment.count({
			where: whereConditions,
		}),
	]);

	return {
		data: shipments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getShipmentDetails = async (shipmentId: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
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
			courierAssignments: {
				include: {
					courier: {
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
			statusHistory: {
				orderBy: {
					createdAt: "asc",
				},
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	return shipment;
};

/**
 * Operations Manager flow:
 * 1. Decides Origin Hub based on pickup address
 * 2. Decides Destination Hub based on delivery address
 * 3. Assigns Courier rider -> moves status to COURIER_ASSIGNED
 */
const assignHubAndCourier = async (
	managerUserId: string,
	shipmentId: string,
	payload: IAssignHubAndCourierPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { pickupAddress: true, deliveryAddress: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	const assignableStatuses: ShipmentStatus[] = [
		ShipmentStatus.PENDING_APPROVAL,
		ShipmentStatus.CREATED,
		ShipmentStatus.AT_ORIGIN_HUB,
		ShipmentStatus.AT_DESTINATION_HUB,
	];

	if (!assignableStatuses.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment is currently in '${shipment.status}' status and cannot be assigned hubs or courier.`,
		);
	}

	const originHubId = payload.originHubId || shipment.originHubId;
	if (!originHubId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Origin hub ID is required.",
		);
	}

	const originHub = await prisma.hub.findUnique({
		where: { id: originHubId },
	});
	if (!originHub?.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or inactive origin hub.",
		);
	}

	const destinationHubId =
		payload.destinationHubId || shipment.destinationHubId || originHubId;
	const destinationHub = await prisma.hub.findUnique({
		where: { id: destinationHubId },
	});
	if (!destinationHub?.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or inactive destination hub.",
		);
	}

	const courier = await prisma.courier.findUnique({
		where: { id: payload.courierId },
		include: { user: true },
	});
	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier rider not found.");
	}

	let deliveryCharge = payload.deliveryCharge;
	if (deliveryCharge === undefined) {
		if (shipment.deliveryCharge && Number(shipment.deliveryCharge) > 0) {
			deliveryCharge = Number(shipment.deliveryCharge);
		} else {
			const pricingRule = await prisma.pricingRule.findFirst({
				where: {
					zoneId: originHub.zoneId,
					deliveryType: shipment.deliveryType,
					isActive: true,
				},
			});
			if (pricingRule) {
				const baseCharge = Number(pricingRule.baseCharge);
				const perKgCharge = Number(pricingRule.perKgCharge);
				const minWeight = Number(pricingRule.minWeight);
				const weight = Number(shipment.weight);
				deliveryCharge =
					weight > minWeight
						? baseCharge + (weight - minWeight) * perKgCharge
						: baseCharge;
			} else {
				deliveryCharge = Number(shipment.deliveryCharge) || 60.0;
			}
		}
	}

	// Determine next status, location, and log note based on current lifecycle stage
	let nextStatus: ShipmentStatus = ShipmentStatus.COURIER_ASSIGNED;
	let statusNote =
		payload.note ||
		`Assigned origin hub (${originHub.name}), destination hub (${destinationHub.name}), and courier rider (${courier.user.name})`;
	let statusLocation = originHub.name;
	let shouldCreateTransfer = false;

	if (
		shipment.status === ShipmentStatus.PENDING_APPROVAL ||
		shipment.status === ShipmentStatus.CREATED
	) {
		nextStatus = ShipmentStatus.COURIER_ASSIGNED;
		statusLocation = originHub.name;
		statusNote =
			payload.note ||
			`Assigned origin hub (${originHub.name}), destination hub (${destinationHub.name}), and courier rider (${courier.user.name})`;
	} else if (shipment.status === ShipmentStatus.AT_ORIGIN_HUB) {
		if (originHub.id !== destinationHub.id) {
			// Inter-hub transit: assign truck driver courier
			nextStatus = ShipmentStatus.IN_TRANSIT;
			statusLocation = originHub.name;
			statusNote =
				payload.note ||
				`Assigned transit driver (${courier.user.name}) for transfer from ${originHub.name} to ${destinationHub.name}. Status updated to IN_TRANSIT.`;
			shouldCreateTransfer = true;
		} else {
			// Same hub local delivery: parcel moves directly to OUT_FOR_DELIVERY
			nextStatus = ShipmentStatus.OUT_FOR_DELIVERY;
			statusLocation = originHub.name;
			statusNote =
				payload.note ||
				`Assigned delivery courier (${courier.user.name}). Parcel is out for local delivery.`;
		}
	} else if (shipment.status === ShipmentStatus.AT_DESTINATION_HUB) {
		// Final delivery dispatch from destination hub
		nextStatus = ShipmentStatus.OUT_FOR_DELIVERY;
		statusLocation = destinationHub.name;
		statusNote =
			payload.note ||
			`Assigned delivery courier (${courier.user.name}) from ${destinationHub.name}. Parcel is out for delivery.`;
	}

	const deliveryOtp =
		nextStatus === ShipmentStatus.OUT_FOR_DELIVERY
			? shipment.deliveryOtp ||
			  Math.floor(100000 + Math.random() * 900000).toString()
			: shipment.deliveryOtp;

	const result = await prisma.$transaction(async (tx) => {
		await tx.courierParcel.create({
			data: {
				shipmentId,
				courierId: courier.id,
				assignedBy: managerUserId,
				status: AssignmentStatus.PENDING,
			},
		});

		if (shouldCreateTransfer) {
			await tx.hubTransfer.create({
				data: {
					shipmentId,
					fromHubId: originHub.id,
					toHubId: destinationHub.id,
					status: TransferStatus.DISPATCHED,
					dispatchedAt: new Date(),
					createdBy: managerUserId,
				},
			});
		}

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: nextStatus,
				location: statusLocation,
				note: statusNote,
				updatedBy: managerUserId,
			},
		});

		const updatedShipment = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				originHubId: originHub.id,
				destinationHubId: destinationHub.id,
				deliveryCharge,
				status: nextStatus,
				...(deliveryOtp ? { deliveryOtp } : {}),
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
				courierAssignments: {
					orderBy: { assignedAt: "desc" },
					include: {
						courier: {
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
			},
		});

		return updatedShipment;
	});

	return result;
};

const rejectShipment = async (
	managerUserId: string,
	shipmentId: string,
	payload: IRejectShipmentPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		shipment.status !== ShipmentStatus.PENDING_APPROVAL &&
		shipment.status !== ShipmentStatus.CREATED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment is currently in '${shipment.status}' status and cannot be rejected.`,
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const cancelledShipment = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.CANCELLED,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.CANCELLED,
				note: `Shipment rejected by Operations Manager. Reason: ${payload.reason}`,
				updatedBy: managerUserId,
			},
		});

		return cancelledShipment;
	});

	return result;
};

// ==========================================
// Helper Services for Operations Routing
// ==========================================

const getCouriers = async (query: ICourierFilterQuery) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.CourierWhereInput = {};

	if (query.hubId) {
		whereConditions.hubId = query.hubId;
	}

	if (query.availabilityStatus) {
		whereConditions.availabilityStatus = query.availabilityStatus;
	}

	if (query.searchTerm) {
		whereConditions.OR = [
			{ vehicleNumber: { contains: query.searchTerm, mode: "insensitive" } },
			{
				user: {
					OR: [
						{ name: { contains: query.searchTerm, mode: "insensitive" } },
						{ phone: { contains: query.searchTerm, mode: "insensitive" } },
						{ email: { contains: query.searchTerm, mode: "insensitive" } },
					],
				},
			},
		];
	}

	const [couriers, total] = await Promise.all([
		prisma.courier.findMany({
			where: whereConditions,
			skip,
			take: limit,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						phone: true,
						email: true,
					},
				},
				hub: {
					select: {
						id: true,
						name: true,
						code: true,
					},
				},
			},
		}),
		prisma.courier.count({
			where: whereConditions,
		}),
	]);

	return {
		data: couriers,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getHubs = async () => {
	const hubs = await prisma.hub.findMany({
		where: { isActive: true },
		include: {
			zone: true,
		},
		orderBy: {
			name: "asc",
		},
	});

	return hubs;
};

/**
 * Assign a local delivery courier rider to take parcel OUT_FOR_DELIVERY
 */
const assignDeliveryCourier = async (
	managerUserId: string,
	shipmentId: string,
	payload: IAssignDeliveryCourierPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: {
			originHub: true,
			destinationHub: true,
		},
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
			`Shipment cannot be assigned for delivery from status '${shipment.status}'.`,
		);
	}

	// If at origin hub and hubs differ, must transfer first
	if (
		shipment.status === ShipmentStatus.AT_ORIGIN_HUB &&
		shipment.originHubId &&
		shipment.destinationHubId &&
		shipment.originHubId !== shipment.destinationHubId
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Shipment is at Origin Hub and must be transferred to Destination Hub before delivery dispatch.",
		);
	}

	const courier = await prisma.courier.findUnique({
		where: { id: payload.courierId },
		include: { user: true },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier rider not found.");
	}

	const result = await prisma.$transaction(async (tx) => {
		await tx.courierParcel.create({
			data: {
				shipmentId,
				courierId: courier.id,
				assignedBy: managerUserId,
				status: AssignmentStatus.PENDING,
			},
		});

		const deliveryOtp =
			shipment.deliveryOtp ||
			Math.floor(100000 + Math.random() * 900000).toString();

		const updatedShipment = await tx.shipment.update({
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
				courierAssignments: {
					include: {
						courier: {
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

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.OUT_FOR_DELIVERY,
				location:
					shipment.destinationHub?.name ||
					shipment.originHub?.name ||
					"Distribution Hub",
				note:
					payload.note ||
					`Assigned delivery courier ${courier.user.name}. Parcel is out for delivery.`,
				updatedBy: managerUserId,
			},
		});

		return updatedShipment;
	});

	return result;
};

/**
 * Dispatch inter-hub transfer -> moves status to IN_TRANSIT
 */
const createHubTransfer = async (
	managerUserId: string,
	shipmentId: string,
	payload: ICreateHubTransferPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { originHub: true, destinationHub: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status !== ShipmentStatus.AT_ORIGIN_HUB) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment must be in 'AT_ORIGIN_HUB' status to initiate inter-hub transfer (current: '${shipment.status}').`,
		);
	}

	const destinationHubId = payload.toHubId || shipment.destinationHubId;

	if (!destinationHubId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Destination hub ID is required for inter-hub transfer.",
		);
	}

	if (destinationHubId === shipment.originHubId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Origin Hub and Destination Hub are the same. Inter-hub transfer is not required; proceed to local delivery dispatch.",
		);
	}

	const destHub = await prisma.hub.findUnique({
		where: { id: destinationHubId },
	});

	if (!destHub?.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or inactive destination hub.",
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const transfer = await tx.hubTransfer.create({
			data: {
				shipmentId,
				fromHubId: shipment.originHubId as string,
				toHubId: destinationHubId,
				status: TransferStatus.DISPATCHED,
				dispatchedAt: new Date(),
				createdBy: managerUserId,
			},
			include: {
				fromHub: true,
				toHub: true,
			},
		});

		const updatedShipment = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.IN_TRANSIT,
				destinationHubId,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.IN_TRANSIT,
				location: shipment.originHub?.name || "Origin Hub",
				note:
					payload.note ||
					`Dispatched in transit from ${shipment.originHub?.name} to ${destHub.name}`,
				updatedBy: managerUserId,
			},
		});

		return {
			transfer,
			shipment: updatedShipment,
		};
	});

	return result;
};

/**
 * Receive transfer at Destination Hub -> moves status to AT_DESTINATION_HUB
 */
const receiveHubTransfer = async (
	managerUserId: string,
	transferId: string,
	payload: IReceiveHubTransferPayload,
) => {
	const transfer = await prisma.hubTransfer.findUnique({
		where: { id: transferId },
		include: { toHub: true, shipment: true },
	});

	if (!transfer) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub transfer record not found.");
	}

	if (
		transfer.status === TransferStatus.RECEIVED ||
		transfer.status === TransferStatus.CANCELLED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Hub transfer is already in '${transfer.status}' state.`,
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const updatedTransfer = await tx.hubTransfer.update({
			where: { id: transferId },
			data: {
				status: TransferStatus.RECEIVED,
				receivedAt: new Date(),
			},
			include: {
				fromHub: true,
				toHub: true,
			},
		});

		const updatedShipment = await tx.shipment.update({
			where: { id: transfer.shipmentId },
			data: {
				status: ShipmentStatus.AT_DESTINATION_HUB,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId: transfer.shipmentId,
				status: ShipmentStatus.AT_DESTINATION_HUB,
				location: transfer.toHub?.name || "Destination Hub",
				note:
					payload.note ||
					`Received and checked in at destination hub (${transfer.toHub?.name})`,
				updatedBy: managerUserId,
			},
		});

		return {
			transfer: updatedTransfer,
			shipment: updatedShipment,
		};
	});

	return result;
};

const getAllHubTransfers = async (query: any) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.HubTransferWhereInput = {};

	if (query.status) {
		whereConditions.status = query.status as TransferStatus;
	}

	if (query.fromHubId) {
		whereConditions.fromHubId = query.fromHubId;
	}

	if (query.toHubId) {
		whereConditions.toHubId = query.toHubId;
	}

	if (query.hubId) {
		whereConditions.OR = [
			{ fromHubId: query.hubId },
			{ toHubId: query.hubId },
		];
	}

	const [transfers, total] = await Promise.all([
		prisma.hubTransfer.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				createdAt: "desc",
			},
			include: {
				shipment: {
					select: {
						id: true,
						trackingNumber: true,
						parcelType: true,
						weight: true,
						status: true,
					},
				},
				fromHub: true,
				toHub: true,
				creator: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		}),
		prisma.hubTransfer.count({
			where: whereConditions,
		}),
	]);

	return {
		data: transfers,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

/**
 * Initiate return flow -> moves status to RETURN_INITIATED
 */
const initiateReturn = async (
	managerUserId: string,
	shipmentId: string,
	payload: IReturnInitiatePayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status === ShipmentStatus.DELIVERED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot initiate return for an already delivered shipment.",
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.RETURN_INITIATED,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.RETURN_INITIATED,
				note: `Return initiated. Reason: ${payload.reason}. ${payload.notes || ""}`.trim(),
				updatedBy: managerUserId,
			},
		});

		return updated;
	});

	return result;
};

/**
 * Move return shipment into transit back to origin/sender -> moves status to RETURN_IN_TRANSIT
 */
const returnInTransit = async (
	managerUserId: string,
	shipmentId: string,
	payload: IReturnInTransitPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { originHub: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status !== ShipmentStatus.RETURN_INITIATED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment must be in 'RETURN_INITIATED' status (current: '${shipment.status}').`,
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.RETURN_IN_TRANSIT,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.RETURN_IN_TRANSIT,
				location: shipment.originHub?.name || "Return Route",
				note: payload.note || "Parcel is in transit back to sender",
				updatedBy: managerUserId,
			},
		});

		return updated;
	});

	return result;
};

/**
 * Cancel a shipment -> moves status to CANCELLED
 */
const cancelShipment = async (
	managerUserId: string,
	shipmentId: string,
	payload: ICancelShipmentPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status === ShipmentStatus.DELIVERED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot cancel an already delivered shipment.",
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.CANCELLED,
			},
		});

		// Cancel any pending/accepted courier assignments
		await tx.courierParcel.updateMany({
			where: {
				shipmentId,
				status: {
					in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED],
				},
			},
			data: {
				status: AssignmentStatus.CANCELLED,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.CANCELLED,
				note: `Shipment cancelled: ${payload.reason}`,
				updatedBy: managerUserId,
			},
		});

		return updated;
	});

	return result;
};

/**
 * Operations Manager updates shipment status to OUT_FOR_DELIVERY
 * Triggered after delivery is handed over to transit by hub manager
 */
const updateOutForDelivery = async (
	managerUserId: string,
	shipmentId: string,
	payload: IUpdateOutForDeliveryPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: {
			originHub: true,
			destinationHub: true,
			customer: true,
			courierAssignments: {
				orderBy: { assignedAt: "desc" },
				take: 1,
				include: { courier: { include: { user: true } } },
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	const allowableStatuses: ShipmentStatus[] = [
		ShipmentStatus.IN_TRANSIT,
		ShipmentStatus.AT_DESTINATION_HUB,
		ShipmentStatus.AT_ORIGIN_HUB,
		ShipmentStatus.RESCHEDULED,
	];

	if (!allowableStatuses.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment cannot be updated to OUT_FOR_DELIVERY from status '${shipment.status}'. Expected status to be IN_TRANSIT, AT_DESTINATION_HUB, or AT_ORIGIN_HUB.`,
		);
	}

	const courierId = payload.courierId;
	let assignedCourierName = shipment.courierAssignments[0]?.courier?.user?.name;

	if (courierId) {
		const courier = await prisma.courier.findUnique({
			where: { id: courierId },
			include: { user: true },
		});
		if (!courier) {
			throw new AppError(httpStatus.NOT_FOUND, "Courier rider not found.");
		}
		assignedCourierName = courier.user.name;
	}

	const result = await prisma.$transaction(async (tx) => {
		if (courierId) {
			await tx.courierParcel.create({
				data: {
					shipmentId,
					courierId,
					assignedBy: managerUserId,
					status: AssignmentStatus.ACCEPTED,
					acceptedAt: new Date(),
				},
			});
		}

		const deliveryOtp =
			shipment.deliveryOtp ||
			Math.floor(100000 + Math.random() * 900000).toString();

		const updatedShipment = await tx.shipment.update({
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
				courierAssignments: {
					orderBy: { assignedAt: "desc" },
					include: {
						courier: {
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

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.OUT_FOR_DELIVERY,
				location:
					shipment.destinationHub?.name ||
					shipment.originHub?.name ||
					"Distribution Hub",
				note:
					payload.note ||
					(assignedCourierName
						? `Parcel is out for delivery with courier rider ${assignedCourierName}.`
						: "Parcel is out for delivery in the recipient zone."),
				updatedBy: managerUserId,
			},
		});

		await tx.notification.create({
			data: {
				userId: shipment.customer.userId,
				shipmentId,
				title: "Shipment Out For Delivery",
				message: `Your shipment ${shipment.trackingNumber} is now out for delivery! Your delivery verification OTP is ${deliveryOtp}.`,
				type: "OUT_FOR_DELIVERY",
			},
		});

		return updatedShipment;
	});

	return result;
};

/**
 * Operations Manager updates shipment status to DELIVERED
 * Prerequisite 1: Courier assignment status must be COMPLETED
 * Prerequisite 2: Shipment paymentStatus must be PAID
 */
const updateDelivered = async (
	managerUserId: string,
	shipmentId: string,
	payload: IUpdateDeliveredPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: {
			courierAssignments: {
				orderBy: { assignedAt: "desc" },
				include: {
					courier: {
						include: {
							user: true,
						},
					},
				},
			},
			payment: true,
			customer: true,
			deliveryAddress: true,
			proofOfDelivery: true,
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status === ShipmentStatus.DELIVERED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Shipment has already been marked as DELIVERED.",
		);
	}

	// 1. Verify that the courier assignment status is COMPLETED
	const hasCompletedAssignment = shipment.courierAssignments.some(
		(assignment) => assignment.status === AssignmentStatus.COMPLETED,
	);

	if (!hasCompletedAssignment) {
		const latestAssignment = shipment.courierAssignments[0];
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot mark shipment as DELIVERED. The courier assignment has not been set to COMPLETED yet (current assignment status: '${latestAssignment?.status || "NO_COURIER_ASSIGNMENT"}').`,
		);
	}

	// 2. Verify that the shipment payment is PAID
	const isPaymentPaid =
		shipment.paymentStatus === PaymentStatus.PAID ||
		shipment.payment?.status === PaymentStatus.PAID;

	if (!isPaymentPaid) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot mark shipment as DELIVERED. The shipment payment must be 'PAID' (current payment status: '${shipment.paymentStatus}').`,
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const updatedShipment = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.DELIVERED,
				paymentStatus: PaymentStatus.PAID,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
				proofOfDelivery: true,
				payment: true,
				courierAssignments: {
					include: {
						courier: {
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

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.DELIVERED,
				location: shipment.deliveryAddress?.area || "Destination Address",
				note:
					payload.note ||
					"Shipment confirmed and marked DELIVERED by Operations Manager after verifying courier completion and payment confirmation.",
				updatedBy: managerUserId,
			},
		});

		await tx.notification.create({
			data: {
				userId: shipment.customer.userId,
				shipmentId,
				title: "Shipment Delivered",
				message: `Your shipment ${shipment.trackingNumber} has been successfully delivered and confirmed by Operations.`,
				type: "SHIPMENT_DELIVERED",
			},
		});

		return updatedShipment;
	});

	return result;
};

export const OperationsManagerService = {
	getAllShipments,
	getShipmentDetails,
	assignHubAndCourier,
	rejectShipment,
	getCouriers,
	getHubs,
	assignDeliveryCourier,
	createHubTransfer,
	receiveHubTransfer,
	getAllHubTransfers,
	initiateReturn,
	returnInTransit,
	cancelShipment,
	updateOutForDelivery,
	updateDelivered,
};

