import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AiInternalService } from "./aiInternal.service";

const getShipmentByTrackingNumber = catchAsync(
	async (req: Request, res: Response) => {
		const { trackingNumber } = req.params;
		console.log(trackingNumber)

		const result = await AiInternalService.getShipmentByTrackingNumber(
			trackingNumber as string,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Shipment details retrieved successfully for AI service.",
			data: result,
		});
	},
);

const getOperationsSummary = catchAsync(async (_req: Request, res: Response) => {
	const result = await AiInternalService.getOperationsSummary();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Operations summary retrieved successfully for AI service.",
		data: result,
	});
});

export const AiInternalController = {
	getShipmentByTrackingNumber,
	getOperationsSummary
};