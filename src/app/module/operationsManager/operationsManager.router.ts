import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validationRequest";
import { OperationsManagerController } from "./operationsManager.controller";
import { OperationsManagerValidation } from "./operationsManager.validation";

const router = Router();

// Protect operations manager routes with OPERATIONS_MANAGER, ADMIN, and HUB_MANAGER roles
router.use(
	auth(UserRole.OPERATIONS_MANAGER, UserRole.ADMIN, UserRole.HUB_MANAGER),
);

// ==========================================
// Operational Shipment Review & Routing
// ==========================================
router.get("/shipments", OperationsManagerController.getAllShipments);
router.get("/shipments/:id", OperationsManagerController.getShipmentDetails);
router.patch(
	"/shipments/:id/assign",
	validateRequest(OperationsManagerValidation.AssignHubAndCourierZodSchema),
	OperationsManagerController.assignHubAndCourier,
);
router.patch(
	"/shipments/:id/reject",
	validateRequest(OperationsManagerValidation.RejectShipmentZodSchema),
	OperationsManagerController.rejectShipment,
);

// Delivery Courier Assignment (Same-Hub or Destination Hub)
router.patch(
	"/shipments/:id/assign-delivery",
	validateRequest(OperationsManagerValidation.AssignDeliveryCourierZodSchema),
	OperationsManagerController.assignDeliveryCourier,
);
router.post(
	"/shipments/:id/assign-delivery",
	validateRequest(OperationsManagerValidation.AssignDeliveryCourierZodSchema),
	OperationsManagerController.assignDeliveryCourier,
);

// Delivery Dispatch & Status Updates
router.patch(
	"/shipments/:id/out-for-delivery",
	validateRequest(OperationsManagerValidation.UpdateOutForDeliveryZodSchema),
	OperationsManagerController.updateOutForDelivery,
);
router.patch(
	"/shipments/:id/delivered",
	validateRequest(OperationsManagerValidation.UpdateDeliveredZodSchema),
	OperationsManagerController.updateDelivered,
);
router.patch(
	"/shipments/:id/mark-delivered",
	validateRequest(OperationsManagerValidation.UpdateDeliveredZodSchema),
	OperationsManagerController.updateDelivered,
);

// Inter-Hub Transfer Operations
router.get("/transfers", OperationsManagerController.getAllHubTransfers);
router.post(
	"/shipments/:id/transfer",
	validateRequest(OperationsManagerValidation.CreateHubTransferZodSchema),
	OperationsManagerController.createHubTransfer,
);
router.patch(
	"/transfers/:id/receive",
	validateRequest(OperationsManagerValidation.ReceiveHubTransferZodSchema),
	OperationsManagerController.receiveHubTransfer,
);

// Return & Cancellation Lifecycle
router.patch(
	"/shipments/:id/return-initiate",
	validateRequest(OperationsManagerValidation.ReturnInitiateZodSchema),
	OperationsManagerController.initiateReturn,
);
router.patch(
	"/shipments/:id/return-in-transit",
	validateRequest(OperationsManagerValidation.ReturnInTransitZodSchema),
	OperationsManagerController.returnInTransit,
);
router.patch(
	"/shipments/:id/cancel",
	validateRequest(OperationsManagerValidation.CancelShipmentZodSchema),
	OperationsManagerController.cancelShipment,
);

// ==========================================
// Logistics Resources Lookup
// ==========================================
router.get("/couriers", OperationsManagerController.getCouriers);
router.get("/hubs", OperationsManagerController.getHubs);

export const OperationsManagerRoutes = router;
