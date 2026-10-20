import { z } from "zod";

const PickupShipmentZodSchema = z.object({
	note: z.string().max(255).optional(),
});

const DeliverToHubZodSchema = z.object({
	note: z.string().max(255).optional(),
});

const StartDeliveryZodSchema = z.object({
	note: z.string().max(255).optional(),
});

const CompleteDeliveryZodSchema = z.object({
	recipientName: z
		.string()
		.min(2, "Recipient name must be at least 2 characters long")
		.max(255),
	recipientPhone: z
		.string()
		.min(6, "Recipient phone must be at least 6 characters long")
		.max(50),
	otp: z
		.string()
		.min(4, "Delivery OTP must be at least 4 digits")
		.max(10),
	imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
	signatureUrl: z
		.string()
		.url("Invalid signature URL")
		.optional()
		.or(z.literal("")),
	notes: z.string().max(500).optional(),
	paymentCollected: z.boolean().optional(),
	paymentMethod: z.string().max(50).optional(),
	transactionId: z.string().max(255).optional(),
});

const DeliveryFailedZodSchema = z.object({
	failureReason: z
		.string()
		.min(3, "Failure reason must be at least 3 characters long")
		.max(255),
	notes: z.string().max(500).optional(),
});

const RescheduleZodSchema = z.object({
	scheduledAt: z.string().min(1, "Scheduled date/time is required"),
	reason: z.string().max(255).optional(),
});

const ReturnedZodSchema = z.object({
	recipientName: z.string().max(255).optional(),
	notes: z.string().max(500).optional(),
});

const RejectAssignmentZodSchema = z.object({
	reason: z.string().max(255).optional(),
});

const UpdateAvailabilityZodSchema = z.object({
	availabilityStatus: z.enum(["AVAILABLE", "BUSY", "OFFLINE"]),
});

export const CourierValidation = {
	PickupShipmentZodSchema,
	DeliverToHubZodSchema,
	StartDeliveryZodSchema,
	CompleteDeliveryZodSchema,
	DeliveryFailedZodSchema,
	RescheduleZodSchema,
	ReturnedZodSchema,
	RejectAssignmentZodSchema,
	UpdateAvailabilityZodSchema,
};
