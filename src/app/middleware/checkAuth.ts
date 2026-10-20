import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { JwtPayload } from "jsonwebtoken";
import type { UserRole } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwtutils";

export interface RequestUser {
	email: string;
	name: string;
	userId: string;
	role: UserRole;
}

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser;
		}
	}
}

// auth(UserRole.ADMIN, UserRole.USER, UserRole.Author)
// auth() => ...requiredRoles => [UserRole.ADMIN, UserRole.USER, UserRole.AUTHOR]
export const auth = (...requiredRoles: UserRole[]) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const token = req.cookies.accessToken
			? req.cookies.accessToken
			: req.headers.authorization?.startsWith("Bearer ")
				? req.headers.authorization?.split(" ")[1]
				: req.headers.authorization;
        console.log(token, "token in auth middleware");
		if (!token) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"You are not logged in. Please log in to access this resource.",
			);
		}

		const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);
		console.log(verifiedToken, "verifiedToken in auth middleware");

		if (!verifiedToken.success) {
			throw new AppError(httpStatus.UNAUTHORIZED, verifiedToken.error);
		}

		const { email, name, userId, role } = verifiedToken.data as JwtPayload;
		console.log(email, name, userId, role, "user details in auth middleware");

		if (requiredRoles.length && !requiredRoles.includes(role)) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Forbidden. You don't have permission to access this resource.",
			);
		}

		const user = await prisma.user.findUnique({
			where: {
				id: userId,
				email,
				name,
				role,
			},
		});

		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User not found. Please log in again.",
			);
		}

		if (user.status === "SUSPENDED") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been suspended. Please contact support.",
			);
		}

		req.user = {
			email,
			name,
			userId,
			role,
		};

		next();
	});
};
