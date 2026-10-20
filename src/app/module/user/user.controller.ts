import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

// ==========================================
// Profile & User Management Controllers
// ==========================================

const getProfile = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.getProfile(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully.",
		data: result,
	});
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.updateProfile(user.userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully.",
		data: result,
	});
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.getAllUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users fetched successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await UserService.getUserById(id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User fetched successfully.",
		data: result,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await UserService.updateUserStatus(id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully.",
		data: result,
	});
});

// ==========================================
// Customer Address Controllers
// ==========================================

const addAddress = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.addAddress(user.userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Address added successfully.",
		data: result,
	});
});

const getMyAddresses = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.getMyAddresses(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Addresses fetched successfully.",
		data: result,
	});
});

const getAddressById = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.getAddressById(
		user.userId,
		id as string,
		user.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Address retrieved successfully.",
		data: result,
	});
});

const updateAddress = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.updateAddress(
		user.userId,
		id as string,
		req.body,
		user.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Address updated successfully.",
		data: result,
	});
});

const deleteAddress = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.deleteAddress(
		user.userId,
		id as string,
		user.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Address deleted successfully.",
		data: result,
	});
});

// ==========================================
// Shipment Request Controllers
// ==========================================

const createShipmentRequest = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user;
		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User information is missing from request context.",
			);
		}

		const result = await UserService.createShipmentRequest(
			user.userId,
			req.body,
		);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Shipment request created successfully.",
			data: result,
		});
	},
);

const getMyShipments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.getMyShipments(user.userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment requests retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getShipmentById = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.getShipmentById(
		user.userId,
		id as string,
		user.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment retrieved successfully.",
		data: result,
	});
});

// ==========================================
// Customer Additional Feature Controllers
// ==========================================

const trackShipment = catchAsync(async (req: Request, res: Response) => {
	const { trackingNumber } = req.params;
	const user = req.user;

	const result = await UserService.trackShipment(
		trackingNumber as string,
		user?.userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment tracking details retrieved successfully.",
		data: result,
	});
});

const schedulePickup = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.schedulePickup(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Pickup scheduled successfully.",
		data: result,
	});
});

const cancelShipment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.cancelShipment(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment cancelled successfully.",
		data: result,
	});
});

const getPricingRules = catchAsync(async (_req: Request, res: Response) => {
	const result = await UserService.getPricingRules();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Active pricing rules retrieved successfully.",
		data: result,
	});
});

const calculatePricing = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.calculatePricing(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Estimated pricing calculated successfully.",
		data: result,
	});
});

const getDeliveryHistory = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.getDeliveryHistory(
		user.userId,
		req.query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Delivery history retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getMyInvoices = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.getMyInvoices(user.userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invoices retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getInvoiceById = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.getInvoiceById(user.userId, id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invoice retrieved successfully.",
		data: result,
	});
});

const reportDeliveryIssue = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.reportDeliveryIssue(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Delivery issue reported successfully.",
		data: result,
	});
});

const getShipmentIssues = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const { id } = req.params;
	const result = await UserService.getShipmentIssues(
		user.userId,
		id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment issues retrieved successfully.",
		data: result,
	});
});

const getMyReportedIssues = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing from request context.",
		);
	}

	const result = await UserService.getMyReportedIssues(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All reported delivery issues retrieved successfully.",
		data: result,
	});
});

export const UserController = {
	getProfile,
	updateProfile,
	getAllUsers,
	getUserById,
	updateUserStatus,
	addAddress,
	getMyAddresses,
	getAddressById,
	updateAddress,
	deleteAddress,
	createShipmentRequest,
	getMyShipments,
	getShipmentById,
	trackShipment,
	schedulePickup,
	cancelShipment,
	getPricingRules,
	calculatePricing,
	getDeliveryHistory,
	getMyInvoices,
	getInvoiceById,
	reportDeliveryIssue,
	getShipmentIssues,
	getMyReportedIssues,
};

