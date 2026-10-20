import { z } from "zod";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";

const CreateStaffUserZodSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters long").max(255),
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters long"),
	phone: z.string().max(50).optional(),
	role: z.nativeEnum(UserRole, {
		message: "Valid staff user role is required",
	}),
	hubId: z.string().uuid("Invalid hub ID").optional(),
	vehicleType: z.string().max(50).optional(),
	vehicleNumber: z.string().max(50).optional(),
});

const UpdateUserZodSchema = z.object({
	name: z.string().min(2).max(255).optional(),
	phone: z.string().max(50).optional(),
	status: z.nativeEnum(UserStatus).optional(),
	role: z.nativeEnum(UserRole).optional(),
});

const CreateHubZodSchema = z.object({
	name: z.string().min(2, "Hub name is required").max(150),
	code: z.string().min(2, "Hub code is required").max(50),
	zoneId: z.string().uuid("Valid zone ID is required"),
	address: z.string().min(3, "Address is required"),
	phone: z.string().max(50).optional(),
});

const UpdateHubZodSchema = z.object({
	name: z.string().min(2).max(150).optional(),
	code: z.string().min(2).max(50).optional(),
	zoneId: z.string().uuid().optional(),
	address: z.string().min(3).optional(),
	phone: z.string().max(50).optional(),
	isActive: z.boolean().optional(),
});

const CreateZoneZodSchema = z.object({
	name: z.string().min(2, "Zone name is required").max(100),
	code: z.string().min(2, "Zone code is required").max(50),
});

const UpdateZoneZodSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	code: z.string().min(2).max(50).optional(),
	isActive: z.boolean().optional(),
});

const CreatePricingRuleZodSchema = z.object({
	zoneId: z.string().uuid("Valid zone ID is required"),
	deliveryType: z.string().max(50).optional().default("STANDARD"),
	minWeight: z.number().nonnegative().optional().default(0.0),
	maxWeight: z.number().positive("Max weight must be positive"),
	baseCharge: z.number().positive("Base charge must be positive"),
	perKgCharge: z.number().nonnegative().optional().default(0.0),
});

const UpdatePricingRuleZodSchema = z.object({
	minWeight: z.number().nonnegative().optional(),
	maxWeight: z.number().positive().optional(),
	baseCharge: z.number().positive().optional(),
	perKgCharge: z.number().nonnegative().optional(),
	isActive: z.boolean().optional(),
});

export const AdminValidation = {
	CreateStaffUserZodSchema,
	UpdateUserZodSchema,
	CreateHubZodSchema,
	UpdateHubZodSchema,
	CreateZoneZodSchema,
	UpdateZoneZodSchema,
	CreatePricingRuleZodSchema,
	UpdatePricingRuleZodSchema,
};
