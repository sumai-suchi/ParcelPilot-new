import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RoleApplicationService } from "./roleApplication.service";

const applyForRole = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await RoleApplicationService.applyForRole(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Role application submitted successfully.",
		data: result,
	});
});

const getMyApplications = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await RoleApplicationService.getMyApplications(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My role applications fetched successfully.",
		data: result,
	});
});

const getAllApplications = catchAsync(async (req: Request, res: Response) => {
	const result = await RoleApplicationService.getAllApplications(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All role applications retrieved successfully.",
		meta: result.meta,
		data: result.data,
	});
});

const getApplicationById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await RoleApplicationService.getApplicationById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Role application retrieved successfully.",
		data: result,
	});
});

const reviewApplication = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const adminUserId = req.user!.userId;
	const result = await RoleApplicationService.reviewApplication(
		id,
		adminUserId,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `Role application has been ${req.body.status.toLowerCase()} successfully.`,
		data: result,
	});
});

const getActiveHubs = catchAsync(async (_req: Request, res: Response) => {
	const result = await RoleApplicationService.getActiveHubs();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Active hubs fetched successfully.",
		data: result,
	});
});

export const RoleApplicationController = {
	applyForRole,
	getMyApplications,
	getAllApplications,
	getApplicationById,
	reviewApplication,
	getActiveHubs,
};
