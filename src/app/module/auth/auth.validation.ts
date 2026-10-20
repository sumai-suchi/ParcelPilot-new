import z from "zod";

const CustomerRegistrationZodSchema = z.object({
	name: z
		.string("Not A String!!!!!")
		.min(3, "Name must atleast 3 characters long!!!")
		.max(100, "Name must be less than 100 characters long!!!"),
	email: z.email("Not email!!"),
	password: z
		.string()
		.min(8, "Password Must Minimum 8 Characters Long.")
		.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
	profilePicture: z.string().optional(),
});

const CustomerEmailVerifyZodSchema = z.object({
	email: z.email("Not email!!"),
	otp: z.string().length(6).refine((val) => console.log(val)),
}).refine((data) => {
	console.log(data.email, data.otp, typeof data.email, typeof data.otp);
}, {
	message: "Email and OTP are required",
});

const LoginZodSchema = z.object({
	email: z.email(),
	password: z
		.string()
		.min(8, "Password Must Minimum 8 Characters Long.")
		.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
});

const ForgotPasswordZodSchema = z.object({
	email: z.email(),
});

const ResetPasswordZodSchema = z.object({
	email: z.email(),
	newPassword: z
		.string()
		.min(8, "Password Must Minimum 8 Characters Long.")
		.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
	otp: z.string().length(6),
});

const GoogleLoginZodSchema = z.object({
	idToken: z.string().min(1, "idToken is required"),
});

export const UserValidation = {
	CustomerRegistrationZodSchema,
	CustomerEmailVerifyZodSchema,
	LoginZodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
	GoogleLoginZodSchema,
};
