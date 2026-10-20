import { z } from "zod";
import { ApplicationStatus, UserRole } from "../../../generated/prisma/enums";

const allowedRoles: readonly UserRole[] = [
	UserRole.COURIER,
	UserRole.HUB_MANAGER,
	UserRole.OPERATIONS_MANAGER,
	UserRole.ADMIN,
];

const CreateRoleApplicationZodSchema = z.object({
	desiredRole: z
		.nativeEnum(UserRole)
		.refine((role) => allowedRoles.includes(role), {
			message: "Role must be COURIER, HUB_MANAGER, OPERATIONS_MANAGER, or ADMIN",
		}),
	notes: z.string().trim().max(1000).optional(),
	experience: z.string().trim().max(1000).optional(),
	vehicleType: z.string().trim().max(50).optional(),
	vehicleNumber: z.string().trim().max(50).optional(),
	hubId: z.string().uuid("Invalid Hub ID format").optional(),
	profilePicture: z.string().url("Invalid profile picture URL").optional().or(z.literal("")),
});

const ReviewRoleApplicationZodSchema = z.object({
	status: z.nativeEnum(ApplicationStatus),
	rejectionReason: z.string().trim().max(1000).optional(),
});

export const RoleApplicationValidation = {
	CreateRoleApplicationZodSchema,
	ReviewRoleApplicationZodSchema,
};
