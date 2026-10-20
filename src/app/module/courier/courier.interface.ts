import type {
	AssignmentStatus,
	ShipmentStatus,
} from "../../../generated/prisma/enums";

export interface ICourierTaskQuery {
	status?: AssignmentStatus;
	shipmentStatus?: ShipmentStatus;
	searchTerm?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface IPickupShipmentPayload {
	note?: string;
}

export interface IDeliverToHubPayload {
	note?: string;
}

export interface IStartDeliveryPayload {
	note?: string;
}

export interface ICompleteDeliveryPayload {
	recipientName: string;
	recipientPhone: string;
	otp: string;
	imageUrl?: string;
	signatureUrl?: string;
	notes?: string;
	paymentCollected?: boolean;
	paymentMethod?: string;
	transactionId?: string;
}

export interface IDeliveryFailedPayload {
	failureReason: string;
	notes?: string;
}

export interface IReschedulePayload {
	scheduledAt: string;
	reason?: string;
}

export interface IReturnedPayload {
	recipientName?: string;
	notes?: string;
}

export interface IRejectAssignmentPayload {
	reason?: string;
}
