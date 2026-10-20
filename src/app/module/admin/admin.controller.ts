import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

// ==========================================
// 1. Overview
// ==========================================
const getDashboardOverview = catchAsync(
	async (_req: Request, res: Response) => {
		const result = await AdminService.getDashboardOverview();

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Admin dashboard overview retrieved successfully.",
			data: result,
		});
	},
);

// ==========================================
// 2. Users Management
// ==========================================
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAllUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getCustomers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getCustomers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Customers retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getCouriers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getCouriers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Couriers retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getHubManagers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getHubManagers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub managers retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getOperationsManagers = catchAsync(
	async (req: Request, res: Response) => {
		const result = await AdminService.getOperationsManagers(req.query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Operations managers retrieved successfully.",
			data: result.data,
			meta: result.meta,
		});
	},
);

const getUserById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.getUserById(id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile details retrieved successfully.",
		data: result,
	});
});

const createStaffUser = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.createStaffUser(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Staff user account created successfully.",
		data: result,
	});
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.updateUser(id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User updated successfully.",
		data: result,
	});
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.deleteUser(id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User deactivated successfully.",
		data: result,
	});
});

// ==========================================
// 3. Infrastructure (Hubs & Zones)
// ==========================================
const getAllZones = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getAllZones();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zones retrieved successfully.",
		data: result,
	});
});

const createZone = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.createZone(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Zone created successfully.",
		data: result,
	});
});

const updateZone = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.updateZone(id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone updated successfully.",
		data: result,
	});
});

const deleteZone = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.deleteZone(id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone deactivated successfully.",
		data: result,
	});
});

const getAllHubs = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getAllHubs();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hubs retrieved successfully.",
		data: result,
	});
});

const createHub = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.createHub(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Hub created successfully.",
		data: result,
	});
});

const bulkCreateHubs = catchAsync(async (req: Request, res: Response) => {
	const items = Array.isArray(req.body)
		? req.body
		: req.body.hubs || req.body.data || [];
	const result = await AdminService.bulkCreateHubs(items);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: `Successfully processed ${result.totalProcessed} hubs (${result.createdCount} created, ${result.updatedCount} updated).`,
		data: result,
	});
});

const updateHub = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.updateHub(id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub updated successfully.",
		data: result,
	});
});

const deleteHub = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.deleteHub(id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub deactivated successfully.",
		data: result,
	});
});

// ==========================================
// 4. Pricing Rules
// ==========================================
const getAllPricingRules = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getAllPricingRules();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Pricing rules retrieved successfully.",
		data: result,
	});
});

const createPricingRule = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.createPricingRule(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Pricing rule created successfully.",
		data: result,
	});
});

const updatePricingRule = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.updatePricingRule(id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Pricing rule updated successfully.",
		data: result,
	});
});

const deletePricingRule = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await AdminService.deletePricingRule(id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Pricing rule deactivated successfully.",
		data: result,
	});
});

// ==========================================
// 5. Global Shipments & Payments
// ==========================================
const getAllShipments = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAllShipments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Global shipments retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAllPayments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Global payments retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

// ==========================================
// 6. Analytics & Reports
// ==========================================
const getRevenueAnalytics = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getRevenueAnalytics();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Revenue analytics retrieved successfully.",
		data: result,
	});
});

const getPerformanceAnalytics = catchAsync(
	async (_req: Request, res: Response) => {
		const result = await AdminService.getPerformanceAnalytics();

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Performance analytics retrieved successfully.",
			data: result,
		});
	},
);

const getHubVolumeReport = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getHubVolumeReport();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub volume reports retrieved successfully.",
		data: result,
	});
});

const getSettings = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getSettings();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Platform settings retrieved successfully.",
		data: result,
	});
});

export const AdminController = {
	getDashboardOverview,
	getAllUsers,
	getCustomers,
	getCouriers,
	getHubManagers,
	getOperationsManagers,
	getUserById,
	createStaffUser,
	updateUser,
	deleteUser,
	getAllZones,
	createZone,
	updateZone,
	deleteZone,
	getAllHubs,
	createHub,
	bulkCreateHubs,
	updateHub,
	deleteHub,
	getAllPricingRules,
	createPricingRule,
	updatePricingRule,
	deletePricingRule,
	getAllShipments,
	getAllPayments,
	getRevenueAnalytics,
	getPerformanceAnalytics,
	getHubVolumeReport,
	getSettings,
};
