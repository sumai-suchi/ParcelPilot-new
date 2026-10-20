import type { Request } from "express";
import httpStatus from "http-status";
import multer from "multer";
import { AppError } from "../utils/AppError";

// Configure in-memory storage buffer
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback,
) => {
	const allowedMimes = [
		"image/jpeg",
		"image/png",
		"image/webp",
		"image/jpg",
	];

	if (allowedMimes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new AppError(
				httpStatus.BAD_REQUEST,
				"Invalid file type. Only JPEG, PNG, and WebP images are permitted.",
			) as any,
		);
	}
};

export const uploadSingleImage = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB maximum file size
	},
}).single("image");
