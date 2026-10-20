import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { AdminRoutes } from "./app/module/admin/admin.router";
import { AuthRoutes } from "./app/module/auth/auth.router";
import { CourierRoutes } from "./app/module/courier/courier.router";
import { OperationsManagerRoutes } from "./app/module/operationsManager/operationsManager.router";
import { PaymentRoutes } from "./app/module/payment/payment.router";
import { RoleApplicationRoutes } from "./app/module/roleApplication/roleApplication.router";
import { UploadRoutes } from "./app/module/upload/upload.router";
import { UserRoutes } from "./app/module/user/user.router";
import { redisClient } from "./app/lib/redis";
import { AiInternalRoutes } from "./app/module/aiInternal/aiInternal.route";

// Enable BigInt serialization in JSON (res.json, JSON.stringify)
(BigInt.prototype as any).toJSON = function () {
	return this.toString();
};

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));
// Middleware in src/app.ts
app.use(async (_req, _res, next) => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware to parse JSON bodies while preserving rawBody buffer for Stripe webhooks

app.use(
	express.json({
		verify: (req: any, _res, buf) => {
			req.rawBody = buf;
		},
	}),
);

app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/operations-manager", OperationsManagerRoutes);
app.use("/api/v1/courier", CourierRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/upload", UploadRoutes);
app.use("/api/v1/role-applications", RoleApplicationRoutes);
app.use("/api/v1/internal", AiInternalRoutes);

app.get("/", async (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to ParcelPilot",
	});
});

app.use(globalErrorHandler);

export default app;
