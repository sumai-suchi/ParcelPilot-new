import type { UserRole, UserStatus } from "../../../generated/prisma/enums";

export interface ICreateAddressPayload {
	label?: string;
	addressLine: string;
	city: string;
	area: string;
	postalCode?: string;
	latitude?: number;
	longitude?: number;
}

export interface IUpdateAddressPayload {
	label?: string;
	addressLine?: string;
	city?: string;
	area?: string;
	postalCode?: string;
	latitude?: number;
	longitude?: number;
}

export interface IUpdateProfilePayload {
	name?: string;
	phone?: string;
	profilePicture?: string;
}

export interface IUpdateUserStatusPayload {
	status?: UserStatus;
	role?: UserRole;
}

export interface IUserFilterQuery {
	searchTerm?: string;
	role?: UserRole;
	status?: UserStatus;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface ICreateShipmentRequestPayload {
	pickupAddress?: ICreateAddressPayload;
	pickupAddressId?: string;
	deliveryAddress?: ICreateAddressPayload;
	deliveryAddressId?: string;
	recipientName?: string;
	recipientPhone?: string;
	parcelType: string;
	weight: number;
	description?: string;
	deliveryType?: string;
	scheduledPickupAt?: string | Date;
}

export interface IShipmentFilterQuery {
	status?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface ISchedulePickupPayload {
	scheduledPickupAt: string;
}

export interface ICancelShipmentPayload {
	reason?: string;
}

export interface ICalculatePricingPayload {
	weight: number;
	deliveryType?: string;
	zoneId?: string;
	pickupCity?: string;
	deliveryCity?: string;
}

export interface IDeliveryHistoryQuery {
	page?: number;
	limit?: number;
	status?: string;
	startDate?: string;
	endDate?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface IReportDeliveryIssuePayload {
	issueType:
		| "DELAYED_DELIVERY"
		| "DAMAGED_PARCEL"
		| "WRONG_ADDRESS"
		| "COURIER_UNREACHABLE"
		| "PACKAGE_LOST"
		| "INCORRECT_STATUS"
		| "BILLING_ISSUE"
		| "OTHER";
	description: string;
	contactPhone?: string;
}

export interface IInvoiceQuery {
	page?: number;
	limit?: number;
	paymentStatus?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

