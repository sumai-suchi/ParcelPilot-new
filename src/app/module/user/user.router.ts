import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validationRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

// ==========================================
// Profile Management
// ==========================================
router.get("/me", auth(), UserController.getProfile);
router.get("/profile", auth(), UserController.getProfile);
router.patch(
	"/profile",
	auth(),
	validateRequest(UserValidation.UpdateProfileZodSchema),
	UserController.updateProfile,
);

// ==========================================
// Customer Address Management
// ==========================================
router.post(
	"/address",
	auth(UserRole.CUSTOMER),
	validateRequest(UserValidation.CreateAddressZodSchema),
	UserController.addAddress,
);
router.get("/address", auth(UserRole.CUSTOMER), UserController.getMyAddresses);
router.get(
	"/address/:id",
	auth(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.OPERATIONS_MANAGER),
	UserController.getAddressById,
);
router.patch(
	"/address/:id",
	auth(UserRole.CUSTOMER, UserRole.ADMIN),
	validateRequest(UserValidation.UpdateAddressZodSchema),
	UserController.updateAddress,
);
router.delete(
	"/address/:id",
	auth(UserRole.CUSTOMER, UserRole.ADMIN),
	UserController.deleteAddress,
);


// ==========================================
// Customer Pricing & Rate Calculation
// ==========================================
router.get("/pricing", UserController.getPricingRules);
router.post(
	"/pricing/calculate",
	validateRequest(UserValidation.CalculatePricingZodSchema),
	UserController.calculatePricing,
);

// ==========================================
// Customer Invoices & Billing
// ==========================================
router.get("/invoices", auth(UserRole.CUSTOMER), UserController.getMyInvoices);
router.get(
	"/shipments/:id/invoice",
	auth(UserRole.CUSTOMER),
	UserController.getInvoiceById,
);

// ==========================================
// Customer Delivery Issues Reporting
// ==========================================
router.get(
	"/delivery-issues",
	auth(UserRole.CUSTOMER),
	UserController.getMyReportedIssues,
);

// ==========================================
// Customer Shipment Management & Lifecycle
// ==========================================

router.post(
	"/create-shipment-request",
	auth(UserRole.CUSTOMER),
	validateRequest(UserValidation.CreateShipmentRequestZodSchema),
	UserController.createShipmentRequest,
);

// Track shipments (placed before /shipments/:id to avoid parameter clash)
router.get(
	"/shipments/track/:trackingNumber",
	UserController.trackShipment,
);

// Delivery history (placed before /shipments/:id)
router.get(
	"/shipments/history",
	auth(UserRole.CUSTOMER),
	UserController.getDeliveryHistory,
);

router.get(
	"/shipments",
	auth(UserRole.CUSTOMER),
	UserController.getMyShipments,
);
router.get(
	"/shipments/:id",
	auth(
		UserRole.CUSTOMER,
		UserRole.ADMIN,
		UserRole.OPERATIONS_MANAGER,
		UserRole.HUB_MANAGER,
	),
	UserController.getShipmentById,
);

// Specific shipment actions
router.patch(
	"/shipments/:id/schedule-pickup",
	auth(UserRole.CUSTOMER),
	validateRequest(UserValidation.SchedulePickupZodSchema),
	UserController.schedulePickup,
);
router.patch(
	"/shipments/:id/cancel",
	auth(UserRole.CUSTOMER),
	validateRequest(UserValidation.CancelShipmentZodSchema),
	UserController.cancelShipment,
);
router.post(
	"/shipments/:id/report-issue",
	auth(UserRole.CUSTOMER),
	validateRequest(UserValidation.ReportDeliveryIssueZodSchema),
	UserController.reportDeliveryIssue,
);
router.get(
	"/shipments/:id/issues",
	auth(UserRole.CUSTOMER),
	UserController.getShipmentIssues,
);



// ==========================================
// User Administration
// ==========================================
router.get(
	"/",
	auth(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER),
	UserController.getAllUsers,
);
router.get(
	"/:id",
	auth(UserRole.ADMIN, UserRole.OPERATIONS_MANAGER),
	UserController.getUserById,
);
router.patch(
	"/:id/status",
	auth(UserRole.ADMIN),
	validateRequest(UserValidation.UpdateUserStatusZodSchema),
	UserController.updateUserStatus,
);

export const UserRoutes = router;
