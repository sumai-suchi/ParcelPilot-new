import type {
	PaymentStatus,
	ShipmentStatus,
	UserRole,
	UserStatus,
} from "../../../generated/prisma/enums";

export interface ICreateStaffUserPayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
	role: UserRole;
	// Courier-specific fields if role is COURIER
	hubId?: string;
	vehicleType?: string;
	vehicleNumber?: string;
}

export interface IUpdateUserPayload {
	name?: string;
	phone?: string;
	status?: UserStatus;
	role?: UserRole;
}

export interface ICreateHubPayload {
	name: string;
	code: string;
	zoneId: string;
	address: string;
	phone?: string;
}

export interface IUpdateHubPayload {
	name?: string;
	code?: string;
	zoneId?: string;
	address?: string;
	phone?: string;
	isActive?: boolean;
}

export interface ICreateZonePayload {
	name: string;
	code: string;
}

export interface IUpdateZonePayload {
	name?: string;
	code?: string;
	isActive?: boolean;
}

export interface ICreatePricingRulePayload {
	zoneId: string;
	deliveryType?: string;
	minWeight?: number;
	maxWeight: number;
	baseCharge: number;
	perKgCharge?: number;
}

export interface IUpdatePricingRulePayload {
	minWeight?: number;
	maxWeight?: number;
	baseCharge?: number;
	perKgCharge?: number;
	isActive?: boolean;
}

export interface IAdminUserFilterQuery {
	role?: UserRole;
	status?: UserStatus;
	searchTerm?: string;
	page?: number;
	limit?: number;
}

export interface IAdminShipmentFilterQuery {
	status?: ShipmentStatus;
	paymentStatus?: PaymentStatus;
	originHubId?: string;
	destinationHubId?: string;
	searchTerm?: string;
	page?: number;
	limit?: number;
}

export interface IAdminPaymentFilterQuery {
	provider?: string;
	status?: PaymentStatus;
	searchTerm?: string;
	page?: number;
	limit?: number;
}
