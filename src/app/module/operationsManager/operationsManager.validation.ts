import { z } from "zod";

const AssignHubAndCourierZodSchema = z.object({
	originHubId: z.string().uuid("Invalid origin hub ID"),
	destinationHubId: z.string().uuid("Invalid destination hub ID"),
	courierId: z.string().uuid("Invalid courier ID"),
	deliveryCharge: z
		.number()
		.positive("Delivery charge must be positive")
		.optional(),
	note: z.string().max(255).optional(),
});

const RejectShipmentZodSchema = z.object({
	reason: z
		.string()
		.min(3, "Rejection reason must be at least 3 characters long")
		.max(500, "Rejection reason cannot exceed 500 characters"),
});

const AssignDeliveryCourierZodSchema = z.object({
	courierId: z.string().uuid("Invalid courier ID"),
	note: z.string().max(255).optional(),
});

const CreateHubTransferZodSchema = z.object({
	toHubId: z.string().uuid("Invalid destination hub ID").optional(),
	note: z.string().max(255).optional(),
});

const ReceiveHubTransferZodSchema = z.object({
	note: z.string().max(255).optional(),
});

const ReturnInitiateZodSchema = z.object({
	reason: z
		.string()
		.min(3, "Return reason must be at least 3 characters long")
		.max(500),
	notes: z.string().max(500).optional(),
});

const ReturnInTransitZodSchema = z.object({
	note: z.string().max(255).optional(),
});

const CancelShipmentZodSchema = z.object({
	reason: z
		.string()
		.min(3, "Cancellation reason must be at least 3 characters long")
		.max(500),
});

const UpdateOutForDeliveryZodSchema = z.object({
	courierId: z.string().uuid("Invalid courier ID").optional(),
	note: z.string().max(255).optional(),
});

const UpdateDeliveredZodSchema = z.object({
	note: z.string().max(255).optional(),
});

export const OperationsManagerValidation = {
	AssignHubAndCourierZodSchema,
	RejectShipmentZodSchema,
	AssignDeliveryCourierZodSchema,
	CreateHubTransferZodSchema,
	ReceiveHubTransferZodSchema,
	ReturnInitiateZodSchema,
	ReturnInTransitZodSchema,
	CancelShipmentZodSchema,
	UpdateOutForDeliveryZodSchema,
	UpdateDeliveredZodSchema,
};

