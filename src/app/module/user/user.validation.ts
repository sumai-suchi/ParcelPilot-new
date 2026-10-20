import { z } from "zod";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";

const CreateAddressZodSchema = z.object({
	label: z.string().max(50).optional(),
	addressLine: z
		.string()
		.trim()
		.min(3, "Address line must be at least 3 characters long"),
	city: z
		.string()
		.trim()
		.min(2, "City must be at least 2 characters long"),
	area: z
		.string()
		.trim()
		.min(2, "Area must be at least 2 characters long"),
	postalCode: z.string().max(20).optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
});

const UpdateAddressZodSchema = z.object({
	label: z.string().max(50).optional(),
	addressLine: z.string().trim().min(3).optional(),
	city: z.string().trim().min(2).optional(),
	area: z.string().trim().min(2).optional(),
	postalCode: z.string().max(20).optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
});

const UpdateProfileZodSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long")
		.max(100)
		.optional(),
	phone: z
		.string()
		.min(6, "Phone must be at least 6 characters")
		.max(50)
		.optional(),
	profilePicture: z.string().optional(),
});

const UpdateUserStatusZodSchema = z.object({
	status: z
		.nativeEnum(UserStatus, {
			message: "Invalid user status",
		})
		.optional(),
	role: z
		.nativeEnum(UserRole, {
			message: "Invalid user role",
		})
		.optional(),
});

const CreateShipmentRequestZodSchema = z
	.object({
		pickupAddress: CreateAddressZodSchema.optional(),
		pickupAddressId: z.string().uuid("Invalid pickup address ID").optional(),
		deliveryAddress: CreateAddressZodSchema.optional(),
		deliveryAddressId: z.string().uuid("Invalid delivery address ID").optional(),
		recipientName: z
			.string()
			.trim()
			.min(2, "Recipient name must be at least 2 characters long")
			.max(100, "Recipient name cannot exceed 100 characters")
			.optional(),
		recipientPhone: z
			.string()
			.trim()
			.regex(
				/^(?:\+?8801[3-9]\d{8}|01[3-9]\d{8}|\+?[1-9]\d{7,14})$/,
				"Invalid recipient phone number format. Must be a valid phone number (e.g., +8801XXXXXXXXX or 01XXXXXXXXX).",
			)
			.optional(),
		parcelType: z.string().trim().min(1, "Parcel type is required"),
		weight: z
			.number({
				message: "Weight must be a valid number",
			})
			.gt(0, "Weight must be greater than zero. Zero or negative weight is not allowed.")
			.min(0.05, "Minimum parcel weight is 0.05 kg (50 grams).")
			.max(500, "Maximum parcel weight allowed is 500 kg. For heavier cargo, please contact freight support."),
		description: z.string().max(1000).optional(),
		deliveryType: z.string().optional().default("STANDARD"),
		scheduledPickupAt: z.string().optional(),
	})
	.refine((data) => Boolean(data.pickupAddress || data.pickupAddressId), {
		message:
			"Missing pickup address. Please provide either 'pickupAddress' details or a saved 'pickupAddressId'.",
		path: ["pickupAddress"],
	})
	.refine((data) => Boolean(data.deliveryAddress || data.deliveryAddressId), {
		message:
			"Missing delivery address. Please provide either 'deliveryAddress' details or a saved 'deliveryAddressId'.",
		path: ["deliveryAddress"],
	});

const SchedulePickupZodSchema = z.object({
	scheduledPickupAt: z.string().min(1, "Scheduled pickup date/time is required"),
});

const CancelShipmentZodSchema = z.object({
	reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
});

const CalculatePricingZodSchema = z.object({
	weight: z
		.number({
			message: "Weight must be a valid number",
		})
		.gt(0, "Weight must be greater than zero. Zero or negative weight is not allowed.")
		.min(0.05, "Minimum parcel weight is 0.05 kg.")
		.max(500, "Maximum parcel weight allowed is 500 kg."),
	deliveryType: z.string().optional().default("STANDARD"),
	zoneId: z.string().uuid("Invalid zone ID").optional(),
	pickupCity: z.string().optional(),
	deliveryCity: z.string().optional(),
});

const ReportDeliveryIssueZodSchema = z.object({
	issueType: z.enum(
		[
			"DELAYED_DELIVERY",
			"DAMAGED_PARCEL",
			"WRONG_ADDRESS",
			"COURIER_UNREACHABLE",
			"PACKAGE_LOST",
			"INCORRECT_STATUS",
			"BILLING_ISSUE",
			"OTHER",
		],
		{
			message: "Invalid issue type",
		},
	),
	description: z
		.string()
		.min(5, "Description must be at least 5 characters long")
		.max(1000, "Description cannot exceed 1000 characters"),
	contactPhone: z.string().max(50).optional(),
});

export const UserValidation = {
	CreateAddressZodSchema,
	UpdateAddressZodSchema,
	UpdateProfileZodSchema,
	UpdateUserStatusZodSchema,
	CreateShipmentRequestZodSchema,
	SchedulePickupZodSchema,
	CancelShipmentZodSchema,
	CalculatePricingZodSchema,
	ReportDeliveryIssueZodSchema,
};

