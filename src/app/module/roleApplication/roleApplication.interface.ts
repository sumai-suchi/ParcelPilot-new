import type { ApplicationStatus, UserRole } from "../../../generated/prisma/enums";

export interface ICreateRoleApplicationPayload {
	desiredRole: UserRole;
	notes?: string;
	experience?: string;
	vehicleType?: string;
	vehicleNumber?: string;
	hubId?: string;
	profilePicture?: string;
}

export interface IReviewRoleApplicationPayload {
	status: ApplicationStatus;
	rejectionReason?: string;
}

export interface IRoleApplicationFilterQuery {
	status?: ApplicationStatus;
	desiredRole?: UserRole;
	searchTerm?: string;
	page?: number | string;
	limit?: number | string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
