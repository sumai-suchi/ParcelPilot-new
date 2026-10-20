import { Router } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { AiInternalController } from "./aiInternal.controller";

const router = Router();

// Middleware: শুধুমাত্র AI Service থেকে আসা রিকোয়েস্ট অ্যালাউ করবে
const checkInternalAuth = (req: any, _res: any, next: any) => {
	const incomingSecret = req.headers["x-internal-service-key"];
	const configuredSecret = config.ai_internal_secret || process.env.AI_INTERNAL_SECRET;
	console.log(incomingSecret, configuredSecret)

	if (!incomingSecret || incomingSecret !== configuredSecret) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Forbidden: Invalid or missing internal service key.",
		);
	}
	next();
};

// Internal AI Lookup Route
router.get(
	"/shipments/:trackingNumber",
	checkInternalAuth,
	AiInternalController.getShipmentByTrackingNumber,
);

export const AiInternalRoutes = router;