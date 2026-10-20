import { Router } from "express";
import { UserRole } from "../../../generated/prisma/browser";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validationRequest";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	validateRequest(UserValidation.CustomerRegistrationZodSchema),

	AuthController.registerCustomerController,
);

router.post(
	"/verify-email",

	AuthController.verifyCustomerEmailController,
);
router.post(
	"/login",
	validateRequest(UserValidation.LoginZodSchema),
	AuthController.loginUser,
);

router.get(
	"/me",
	auth(
		UserRole.ADMIN,
		UserRole.CUSTOMER,
		UserRole.HUB_MANAGER,
		UserRole.OPERATIONS_MANAGER,
		UserRole.COURIER,
	),
	// validateRequest
	AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post(
	"/google",
	validateRequest(UserValidation.GoogleLoginZodSchema),
	AuthController.googleLogin,
);
router.post(
	"/forgot-password",
	validateRequest(UserValidation.ForgotPasswordZodSchema),
	AuthController.forgotPassword,
);
router.post(
	"/reset-password",
	validateRequest(UserValidation.ResetPasswordZodSchema),
	AuthController.resetPassword,
);
router.post("/logout", AuthController.logout);
export const AuthRoutes = router;
