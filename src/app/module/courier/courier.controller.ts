import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CourierService } from "./courier.service";

const getMyTasks = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const result = await CourierService.getMyTasks(user.userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier tasks retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getTaskById = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.getTaskById(user.userId, id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task assignment details retrieved successfully.",
		data: result,
	});
});

const acceptAssignment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.acceptAssignment(
		user.userId,
		id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task assignment accepted successfully.",
		data: result,
	});
});

const rejectAssignment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.rejectAssignment(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task assignment rejected successfully.",
		data: result,
	});
});

const pickupShipment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.pickupShipment(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Parcel successfully picked up from sender.",
		data: result,
	});
});

const deliverToOriginHub = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.deliverToOriginHub(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Parcel delivered and checked into Origin Hub successfully.",
		data: result,
	});
});

const startDelivery = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.startDelivery(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Parcel is now Out for Delivery.",
		data: result,
	});
});

const completeDelivery = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.completeDelivery(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Parcel delivered successfully with proof of delivery.",
		data: result,
	});
});

const recordDeliveryFailed = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.recordDeliveryFailed(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Delivery attempt failure recorded.",
		data: result,
	});
});

const rescheduleDelivery = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.rescheduleDelivery(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Delivery attempt rescheduled successfully.",
		data: result,
	});
});

const returnShipment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await CourierService.returnShipment(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Parcel return completed successfully.",
		data: result,
	});
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const result = await CourierService.getMyProfile(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier profile retrieved successfully.",
		data: result,
	});
});

const updateAvailability = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const result = await CourierService.updateAvailability(
		user.userId,
		req.body.availabilityStatus,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courier availability updated successfully.",
		data: result,
	});
});

export const CourierController = {
	getMyProfile,
	updateAvailability,
	getMyTasks,
	getTaskById,
	acceptAssignment,
	rejectAssignment,
	pickupShipment,
	deliverToOriginHub,
	startDelivery,
	completeDelivery,
	recordDeliveryFailed,
	rescheduleDelivery,
	returnShipment,
};
