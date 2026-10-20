import { z } from "zod";

const CreatePaymentIntentZodSchema = z.object({
	currency: z.string().max(10).optional(),
});

const ConfirmPaymentZodSchema = z.object({
	paymentIntentId: z.string().min(5, "Valid PaymentIntent ID is required"),
	paymentMethodId: z.string().optional(),
});

export const PaymentValidation = {
	CreatePaymentIntentZodSchema,
	ConfirmPaymentZodSchema,
};
