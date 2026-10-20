import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validationRequest";
import { CourierController } from "./courier.controller";
import { CourierValidation } from "./courier.validation";

const router = Router();

// ==========================================
// Courier Profile & Availability Operations
// ==========================================
router.get(
	"/me",
	auth(UserRole.COURIER, UserRole.ADMIN, UserRole.OPERATIONS_MANAGER),
	CourierController.getMyProfile,
);

router.patch(
	"/availability",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.UpdateAvailabilityZodSchema),
	CourierController.updateAvailability,
);

// ==========================================
// Task & Assignment Operations
// ==========================================
router.get(
	"/tasks",
	auth(UserRole.COURIER, UserRole.ADMIN, UserRole.OPERATIONS_MANAGER),
	CourierController.getMyTasks,
);

router.get(
	"/tasks/:id",
	auth(UserRole.COURIER, UserRole.ADMIN, UserRole.OPERATIONS_MANAGER),
	CourierController.getTaskById,
);

router.patch(
	"/assignments/:id/accept",
	auth(UserRole.COURIER),
	CourierController.acceptAssignment,
);

router.patch(
	"/assignments/:id/reject",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.RejectAssignmentZodSchema),
	CourierController.rejectAssignment,
);

// ==========================================
// Parcel Pickup & Hub Check-in
// ==========================================
router.patch(
	"/shipments/:id/pickup",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.PickupShipmentZodSchema),
	CourierController.pickupShipment,
);

router.patch(
	"/shipments/:id/deliver-to-hub",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.DeliverToHubZodSchema),
	CourierController.deliverToOriginHub,
);

// ==========================================
// Delivery Operations
// ==========================================
router.patch(
	"/shipments/:id/out-for-delivery",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.StartDeliveryZodSchema),
	CourierController.startDelivery,
);

router.patch(
	"/shipments/:id/deliver",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.CompleteDeliveryZodSchema),
	CourierController.completeDelivery,
);

router.patch(
	"/shipments/:id/delivery-failed",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.DeliveryFailedZodSchema),
	CourierController.recordDeliveryFailed,
);

router.patch(
	"/shipments/:id/reschedule",
	auth(UserRole.COURIER, UserRole.OPERATIONS_MANAGER),
	validateRequest(CourierValidation.RescheduleZodSchema),
	CourierController.rescheduleDelivery,
);

router.patch(
	"/shipments/:id/return",
	auth(UserRole.COURIER),
	validateRequest(CourierValidation.ReturnedZodSchema),
	CourierController.returnShipment,
);

export const CourierRoutes = router;
