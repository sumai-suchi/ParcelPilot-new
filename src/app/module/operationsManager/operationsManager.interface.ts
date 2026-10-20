import type {
	CourierAvailability,
	ShipmentStatus,
} from "../../../generated/prisma/enums";

export interface IAssignHubAndCourierPayload {
	originHubId: string;
	destinationHubId: string;
	courierId: string;
	deliveryCharge?: number;
	note?: string;
}

export interface IRejectShipmentPayload {
	reason: string;
}

export interface IOperationsShipmentFilterQuery {
	status?: ShipmentStatus;
	originHubId?: string;
	destinationHubId?: string;
	searchTerm?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface ICourierFilterQuery {
	hubId?: string;
	availabilityStatus?: CourierAvailability;
	searchTerm?: string;
	page?: number;
	limit?: number;
}

export interface IAssignDeliveryCourierPayload {
	courierId: string;
	note?: string;
}

export interface ICreateHubTransferPayload {
	toHubId?: string;
	note?: string;
}

export interface IReceiveHubTransferPayload {
	note?: string;
}

export interface IReturnInitiatePayload {
	reason: string;
	notes?: string;
}

export interface IReturnInTransitPayload {
	note?: string;
}

export interface ICancelShipmentPayload {
	reason: string;
}

export interface IUpdateOutForDeliveryPayload {
	courierId?: string;
	note?: string;
}

export interface IUpdateDeliveredPayload {
	note?: string;
}
