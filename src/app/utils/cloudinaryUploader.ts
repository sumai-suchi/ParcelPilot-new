import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../lib/cloudinary";

import config from "../config";
import { AppError } from "./AppError";
import httpStatus from "http-status";

export const uploadBufferToCloudinary = (
	buffer: Buffer,
	folder: string = "parcelpilot/avatars",
): Promise<UploadApiResponse> => {
	return new Promise((resolve, reject) => {
		if (
			!config.cloudinary_cloud_name ||
			!config.cloudinary_api_key ||
			!config.cloudinary_api_secret ||
			config.cloudinary_cloud_name === "sdcv743ljv"
		) {
			return reject(
				new AppError(
					httpStatus.BAD_REQUEST,
					"Cloudinary API credentials are missing or invalid in server .env. Please configure your CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
				),
			);
		}

		const uploadStream = cloudinary.uploader.upload_stream(
			{
				folder,
				resource_type: "image",
			},
			(error, result) => {
				if (error || !result) {
					return reject(
						error ||
							new AppError(
								httpStatus.BAD_REQUEST,
								"Cloudinary upload failed. Please verify your Cloudinary API credentials.",
							),
					);
				}
				resolve(result);
			},
		);

		uploadStream.end(buffer);
	});
};
