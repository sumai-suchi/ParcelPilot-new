import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validationRequest";
import { RoleApplicationController } from "./roleApplication.controller";
import { RoleApplicationValidation } from "./roleApplication.validation";

const router = Router();

// Hub selection for applicants
router.get("/hubs", auth(), RoleApplicationController.getActiveHubs);

// Current user role applications
router.get("/my", auth(), RoleApplicationController.getMyApplications);
router.post(
	"/",
	auth(),
	validateRequest(RoleApplicationValidation.CreateRoleApplicationZodSchema),
	RoleApplicationController.applyForRole,
);

// Admin-only endpoints
router.get("/", auth(UserRole.ADMIN), RoleApplicationController.getAllApplications);
router.get("/:id", auth(UserRole.ADMIN), RoleApplicationController.getApplicationById);
router.patch(
	"/:id/review",
	auth(UserRole.ADMIN),
	validateRequest(RoleApplicationValidation.ReviewRoleApplicationZodSchema),
	RoleApplicationController.reviewApplication,
);

export const RoleApplicationRoutes = router;
