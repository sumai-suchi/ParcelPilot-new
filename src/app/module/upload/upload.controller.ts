import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { uploadBufferToCloudinary } from "../../utils/cloudinaryUploader";
import { sendResponse } from "../../utils/sendResponse";

const uploadImage = catchAsync(async (req: Request, res: Response) => {
	const file = req.file;

	if (!file) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"No image file was provided in the request.",
		);
	}

	const folder = (req.body?.folder as string) || "parcelpilot/avatars";
	const uploadResult = await uploadBufferToCloudinary(file.buffer, folder);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Image uploaded successfully to Cloudinary.",
		data: {
			url: uploadResult.secure_url,
			publicId: uploadResult.public_id,
			format: uploadResult.format,
			bytes: uploadResult.bytes,
		},
	});
});

export const UploadController = {
	uploadImage,
};
