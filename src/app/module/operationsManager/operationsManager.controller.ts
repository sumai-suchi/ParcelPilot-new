import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OperationsManagerService } from "./operationsManager.service";

const getAllShipments = catchAsync(async (req: Request, res: Response) => {
	const result = await OperationsManagerService.getAllShipments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipments retrieved successfully for operational review.",
		data: result.data,
		meta: result.meta,
	});
});

const getShipmentDetails = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await OperationsManagerService.getShipmentDetails(
		id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment operational details retrieved successfully.",
		data: result,
	});
});

const assignHubAndCourier = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.assignHubAndCourier(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Origin Hub, Destination Hub, and Courier assigned successfully.",
		data: result,
	});
});

const rejectShipment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.rejectShipment(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment rejected successfully.",
		data: result,
	});
});

const getCouriers = catchAsync(async (req: Request, res: Response) => {
	const result = await OperationsManagerService.getCouriers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Couriers retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getHubs = catchAsync(async (_req: Request, res: Response) => {
	const result = await OperationsManagerService.getHubs();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Distribution hubs retrieved successfully.",
		data: result,
	});
});

const assignDeliveryCourier = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user;
		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User context missing from request.",
			);
		}

		const { id } = req.params;
		const result = await OperationsManagerService.assignDeliveryCourier(
			user.userId,
			id as string,
			req.body,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Delivery courier assigned and parcel is Out for Delivery.",
			data: result,
		});
	},
);

const createHubTransfer = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.createHubTransfer(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Inter-hub transfer initiated successfully. Parcel is In Transit.",
		data: result,
	});
});

const receiveHubTransfer = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.receiveHubTransfer(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message:
			"Hub transfer received successfully. Parcel is At Destination Hub.",
		data: result,
	});
});

const getAllHubTransfers = catchAsync(async (req: Request, res: Response) => {
	const result = await OperationsManagerService.getAllHubTransfers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub transfers retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const initiateReturn = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.initiateReturn(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Return process initiated successfully.",
		data: result,
	});
});

const returnInTransit = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.returnInTransit(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Return in transit updated successfully.",
		data: result,
	});
});

const cancelShipment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.cancelShipment(
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

const updateOutForDelivery = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.updateOutForDelivery(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment status updated to OUT_FOR_DELIVERY successfully.",
		data: result,
	});
});

const updateDelivered = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User context missing from request.",
		);
	}

	const { id } = req.params;
	const result = await OperationsManagerService.updateDelivered(
		user.userId,
		id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment verified and status updated to DELIVERED successfully.",
		data: result,
	});
});

export const OperationsManagerController = {
	getAllShipments,
	getShipmentDetails,
	assignHubAndCourier,
	rejectShipment,
	getCouriers,
	getHubs,
	assignDeliveryCourier,
	createHubTransfer,
	receiveHubTransfer,
	getAllHubTransfers,
	initiateReturn,
	returnInTransit,
	cancelShipment,
	updateOutForDelivery,
	updateDelivered,
};

