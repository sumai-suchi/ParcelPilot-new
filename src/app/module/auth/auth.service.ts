import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import path from "path";
import {
	AuthProvider,
	UserRole,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import googleClient from "../../lib/googleOAuth";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwtutils";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterCustomerPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
	const { name, password, profilePicture } = payload;

	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	const expirationSeconds = 5 * 60;

	const otpKey = `customer-registration-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",

			value: expirationSeconds,
		},
	});

	const customerRegistrationKey = `customer-registration-data:${email}`;
	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		profilePicture,
	};

	await redisClient.set(
		customerRegistrationKey,
		JSON.stringify(redisUserDataPayload),
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);

	const templateData = {
		name,
		email,
		otp: otpValue,
		expirationMinutes: expirationSeconds / 60,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email Verification",

		html,
	});
};

const verifyCustomerEmail = async (payload: IVerifyEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();
	console.log(email, otp, "email and otp in verifyCustomerEmail");

	const isUserExist = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExist?.status === "SUSPENDED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is SUSPENDED");
	}

	if (isUserExist?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "Email ALready Verified");
	}

	if (isUserExist?.status && isUserExist?.status === "INACTIVE") {
		throw new AppError(httpStatus.FORBIDDEN, "User is INACTIVE");
	}

	const otpKey = `customer-registration-otp:${email}`;

	const redisOtp = await redisClient.get(otpKey);
	console.log(redisOtp, "redisOtp in verifyCustomerEmail");

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
	}

	await redisClient.del(otpKey);

	const customerRegistrationKey = `customer-registration-data:${email}`;

	const redisCustomerData = await redisClient.get(customerRegistrationKey);

	if (!redisCustomerData) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer Doesnt Exist");
	}

	const customerPayload: IRegisterCustomerPayload =
		JSON.parse(redisCustomerData);

	console.log("Customer Payload:", customerPayload);
	const createdUser = await prisma.user.create({
		data: {
			name: customerPayload.name,
			email: customerPayload.email,
			password: customerPayload.password,
			profilePicture: customerPayload.profilePicture,
			role: UserRole.CUSTOMER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			customer: {
				create: {},
			},
		},
		omit: { password: true },
		include: { customer: true },
	});

	await redisClient.del(customerRegistrationKey);

	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/customer-welcome-email.ejs",
	);

	const templateData = {
		name: createdUser.name,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Welcome To PH Healthcare System",
		// text : `Your OTP is ${otp}`
		// html: `<h1>Your OTP is ${otp}</h1>`
		html,
	});

	const { customer, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id.toString(),
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		customer,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	// throw new Error("Test Error");

	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		// throw new Error("User not found");
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	}

	if (user.status === "SUSPENDED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Suspended");
	}

	if (!user.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "User Not Verified");
	}

	if (user.status && user.status === "INACTIVE") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Inactive");
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User Already Has Account Registered With Google. Try To Login With Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id.toString(),
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (
		!user ||
		user.status === UserStatus.SUSPENDED ||
		user.status !== UserStatus.ACTIVE
	) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error: any) {
		console.error("Error verifying Google ID token:", error);
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Failed to verify Google ID token: " + (error?.message || "Invalid token"),
		);
	}

	if (!googleIdTokenPayload) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid Or Expired Google Id Token",
		);
	}

	if (!googleIdTokenPayload.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Email Not Found");
	}
	if (!googleIdTokenPayload.name) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google Email User Name Not Found",
		);
	}

	const normalizedEmail = googleIdTokenPayload.email.trim().toLowerCase();

	// Check if user exists by unique email
	let user = await prisma.user.findUnique({
		where: {
			email: normalizedEmail,
		},
	});

	if (user) {
		if (user.status === UserStatus.SUSPENDED) {
			throw new AppError(httpStatus.FORBIDDEN, "User Is Suspended");
		}

		if (user.status === UserStatus.INACTIVE) {
			throw new AppError(httpStatus.FORBIDDEN, "User Is Inactive");
		}

		// Link Google ID, mark email verified, and attach avatar if not already present
		user = await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				googleId: user.googleId || googleIdTokenPayload.sub,
				emailVerified: true,
				profilePicture: user.profilePicture || googleIdTokenPayload.picture || null,
			},
		});
	} else {
		// New Google Register as Customer
		user = await prisma.user.create({
			data: {
				name: googleIdTokenPayload.name,
				email: normalizedEmail,
				role: UserRole.CUSTOMER,
				googleId: googleIdTokenPayload.sub,
				authProvider: AuthProvider.GOOGLE,
				emailVerified: true,
				profilePicture: googleIdTokenPayload.picture || null,
				customer: {
					create: {},
				},
			},
		});
	}

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	}

	const jwtPayload = {
		userId: user.id.toString(),
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

// const refreshToken = async (token: string) => {
// 	const verifiedRefreshToken = jwtUtils.verifyToken(
// 		token,
// 		config.jwt_refresh_secret,
// 	);

// 	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
// 		throw new AppError(
// 			httpStatus.UNAUTHORIZED,
// 			config.node_env === "development"
// 				? verifiedRefreshToken.error
// 				: "Invalid refresh token",
// 		);
// 	}

// 	const data = verifiedRefreshToken.data as JwtPayload;

// 	const user = await prisma.user.findUnique({
// 		where: { id: data.userId },
// 	});

// 	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
// 		throw new AppError(
// 			httpStatus.UNAUTHORIZED,
// 			"User is inactive or not found",
// 		);
// 	}

// 	const jwtPayload = {
// 		userId: user.id,
// 		name: user.name,
// 		email: user.email,
// 		role: user.role,
// 	};

// 	const accessToken = jwtUtils.createToken(
// 		jwtPayload,
// 		config.jwt_access_secret,
// 		config.jwt_access_expires_in as SignOptions,
// 	);

// 	const refreshToken = jwtUtils.createToken(
// 		jwtPayload,
// 		config.jwt_refresh_secret,
// 		config.jwt_refresh_expires_in as SignOptions,
// 	);

// 	return {
// 		accessToken,
// 		refreshToken,
// 	};
// };

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},

		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return isUserExists;
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;

	const isUserExist = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exist!");
	}

	if (isUserExist.status === "SUSPENDED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Suspended");
	}

	if (!isUserExist.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "User Not Verified");
	}

	if (isUserExist.status && isUserExist.status === "INACTIVE") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Inactive");
	}

	if (isUserExist.googleId && isUserExist.authProvider === "GOOGLE") {
		throw new AppError(httpStatus.BAD_REQUEST, "User Has Account With Google");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();

	const key = `forgor-password-otp:${isUserExist.email}`;

	const expirationSeconds = 5 * 60;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/forgotPassword.ejs",
	);

	const templateData = {
		name: isUserExist.name,
		otp,
		expirationMinutes: expirationSeconds / 60,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExist.email,
		subject: "Forgot Password",
		// text : `Your OTP is ${otp}`
		// html: `<h1>Your OTP is ${otp}</h1>`
		html,
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExist = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exist!");
	}

	if (isUserExist.status === "SUSPENDED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Suspended");
	}

	if (!isUserExist.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "User Not Verified");
	}

	if (isUserExist.status && isUserExist.status === "INACTIVE") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Inactive");
	}

	if (isUserExist.googleId && isUserExist.authProvider === "GOOGLE") {
		throw new AppError(httpStatus.BAD_REQUEST, "User Has Account With Google");
	}

	const key = `forgor-password-otp:${isUserExist.email}`;

	const redisOtp = await redisClient.get(key);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: {
			email: isUserExist.email,
		},
		data: {
			password: hashedNewPassword,
		},
	});

	await redisClient.del([key]);

	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);

	const templateData = {
		name: isUserExist.name,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExist.email,
		subject: "Password Changed",

		html,
	});
};

export const AuthService = {
	googleLogin,
	registerCustomer,
	verifyCustomerEmail,
	forgotPassword,
	resetPassword,
	loginUser,
	refreshToken,
	getMe,
};
