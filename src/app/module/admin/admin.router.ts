import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validationRequest";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";

const router = Router();

// Protect ALL admin routes with ADMIN role exclusively
router.use(auth(UserRole.ADMIN));

// ==========================================
// 1. Dashboard Overview
// ==========================================
router.get("/dashboard/overview", AdminController.getDashboardOverview);

// ==========================================
// 2. Workforce & User Management
// ==========================================
router.get("/users", AdminController.getAllUsers);
router.post(
	"/users",
	validateRequest(AdminValidation.CreateStaffUserZodSchema),
	AdminController.createStaffUser,
);
router.get("/users/:id", AdminController.getUserById);
router.patch(
	"/users/:id",
	validateRequest(AdminValidation.UpdateUserZodSchema),
	AdminController.updateUser,
);
router.delete("/users/:id", AdminController.deleteUser);

// Role-specific quick views
router.get("/customers", AdminController.getCustomers);
router.get("/couriers", AdminController.getCouriers);
router.get("/hub-managers", AdminController.getHubManagers);
router.get("/operations-managers", AdminController.getOperationsManagers);

// ==========================================
// 3. Infrastructure Management (Zones & Hubs)
// ==========================================
router.get("/zones", AdminController.getAllZones);
router.post(
	"/zones",
	validateRequest(AdminValidation.CreateZoneZodSchema),
	AdminController.createZone,
);
router.patch(
	"/zones/:id",
	validateRequest(AdminValidation.UpdateZoneZodSchema),
	AdminController.updateZone,
);
router.delete("/zones/:id", AdminController.deleteZone);

router.get("/hubs", AdminController.getAllHubs);
router.post(
	"/hubs",
	validateRequest(AdminValidation.CreateHubZodSchema),
	AdminController.createHub,
);
router.post("/hubs/bulk", AdminController.bulkCreateHubs);
router.patch(
	"/hubs/:id",
	validateRequest(AdminValidation.UpdateHubZodSchema),
	AdminController.updateHub,
);
router.delete("/hubs/:id", AdminController.deleteHub);

// ==========================================
// 4. Pricing Rules Administration
// ==========================================
router.get("/pricing", AdminController.getAllPricingRules);
router.post(
	"/pricing",
	validateRequest(AdminValidation.CreatePricingRuleZodSchema),
	AdminController.createPricingRule,
);
router.patch(
	"/pricing/:id",
	validateRequest(AdminValidation.UpdatePricingRuleZodSchema),
	AdminController.updatePricingRule,
);
router.delete("/pricing/:id", AdminController.deletePricingRule);

// ==========================================
// 5. Global Shipments & Payments Oversight
// ==========================================
router.get("/shipments", AdminController.getAllShipments);
router.get("/payments", AdminController.getAllPayments);

// ==========================================
// 6. Analytics & Reports
// ==========================================
router.get("/analytics/revenue", AdminController.getRevenueAnalytics);
router.get("/analytics/performance", AdminController.getPerformanceAnalytics);
router.get("/reports/hub-volume", AdminController.getHubVolumeReport);

// ==========================================
// 7. System Settings
// ==========================================
router.get("/settings", AdminController.getSettings);

export const AdminRoutes = router;
