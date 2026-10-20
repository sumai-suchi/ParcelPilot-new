import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { ApplicationStatus, UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateRoleApplicationPayload,
	IReviewRoleApplicationPayload,
	IRoleApplicationFilterQuery,
} from "./roleApplication.interface";

const hubSelectFields = {
	id: true,
	name: true,
	code: true,
	address: true,
	zone: {
		select: {
			id: true,
			name: true,
		},
	},
};

const userSelectFields = {
	id: true,
	name: true,
	email: true,
	phone: true,
	profilePicture: true,
	role: true,
};

const applyForRole = async (
	userId: string,
	payload: ICreateRoleApplicationPayload,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	if (user.status === "SUSPENDED") {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Your account is suspended. You cannot apply for roles.",
		);
	}

	if (user.role === payload.desiredRole) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`You are already assigned as ${payload.desiredRole}.`,
		);
	}

	const existingPending = await prisma.roleApplication.findFirst({
		where: {
			userId,
			status: ApplicationStatus.PENDING,
		},
	});

	if (existingPending) {
		throw new AppError(
			httpStatus.CONFLICT,
			"You already have a pending application awaiting review.",
		);
	}

	if (payload.hubId) {
		const hubExists = await prisma.hub.findUnique({
			where: { id: payload.hubId },
		});
		if (!hubExists) {
			throw new AppError(httpStatus.NOT_FOUND, "Selected hub was not found.");
		}
	}

	// If applicant provided a profile picture URL, update their user record
	if (payload.profilePicture) {
		await prisma.user.update({
			where: { id: userId },
			data: {
				profilePicture: payload.profilePicture,
			},
		});
	}

	const application = await prisma.roleApplication.create({
		data: {
			userId,
			desiredRole: payload.desiredRole,
			notes: payload.notes || null,
			experience: payload.experience || null,
			vehicleType: payload.vehicleType || null,
			vehicleNumber: payload.vehicleNumber || null,
			hubId: payload.hubId || null,
			status: ApplicationStatus.PENDING,
		},
		include: {
			user: {
				select: userSelectFields,
			},
			hub: {
				select: hubSelectFields,
			},
		},
	});

	return application;
};

const getMyApplications = async (userId: string) => {
	const applications = await prisma.roleApplication.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		include: {
			hub: {
				select: hubSelectFields,
			},
		},
	});

	return applications;
};

const getAllApplications = async (query: IRoleApplicationFilterQuery) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.RoleApplicationWhereInput = {};

	if (query.status) {
		whereConditions.status = query.status;
	}

	if (query.desiredRole) {
		whereConditions.desiredRole = query.desiredRole;
	}

	if (query.searchTerm) {
		whereConditions.OR = [
			{
				user: {
					name: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			},
			{
				user: {
					email: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			},
			{
				vehicleNumber: {
					contains: query.searchTerm,
					mode: "insensitive",
				},
			},
		];
	}

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const [applications, total] = await Promise.all([
		prisma.roleApplication.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				user: {
					select: userSelectFields,
				},
				hub: {
					select: hubSelectFields,
				},
			},
		}),
		prisma.roleApplication.count({
			where: whereConditions,
		}),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
		data: applications,
	};
};

const getApplicationById = async (id: string) => {
	const application = await prisma.roleApplication.findUnique({
		where: { id },
		include: {
			user: {
				select: userSelectFields,
			},
			hub: {
				select: hubSelectFields,
			},
		},
	});

	if (!application) {
		throw new AppError(httpStatus.NOT_FOUND, "Role application not found.");
	}

	return application;
};

const reviewApplication = async (
	applicationId: string,
	adminUserId: string,
	payload: IReviewRoleApplicationPayload,
) => {
	const application = await prisma.roleApplication.findUnique({
		where: { id: applicationId },
		include: { user: true },
	});

	if (!application) {
		throw new AppError(httpStatus.NOT_FOUND, "Role application not found.");
	}

	if (application.status !== ApplicationStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`This application has already been ${application.status.toLowerCase()}.`,
		);
	}

	return await prisma.$transaction(async (tx) => {
		if (payload.status === ApplicationStatus.APPROVED) {
			const updatedApp = await tx.roleApplication.update({
				where: { id: applicationId },
				data: {
					status: ApplicationStatus.APPROVED,
					reviewedBy: adminUserId,
					reviewedAt: new Date(),
				},
			});

			// Update the user's role to the approved desired role
			await tx.user.update({
				where: { id: application.userId },
				data: {
					role: application.desiredRole,
				},
			});

			// If courier role, create or update the courier profile
			if (application.desiredRole === UserRole.COURIER) {
				let targetHubId = application.hubId;
				if (!targetHubId) {
					const firstHub = await tx.hub.findFirst({
						where: { isActive: true },
						select: { id: true },
					});
					targetHubId = firstHub?.id || null;
				}

				if (targetHubId) {
					await tx.courier.upsert({
						where: { userId: application.userId },
						update: {
							hubId: targetHubId,
							vehicleType: application.vehicleType || "Motorcycle",
							vehicleNumber: application.vehicleNumber || "N/A",
							availabilityStatus: "AVAILABLE",
						},
						create: {
							userId: application.userId,
							hubId: targetHubId,
							vehicleType: application.vehicleType || "Motorcycle",
							vehicleNumber: application.vehicleNumber || "N/A",
							availabilityStatus: "AVAILABLE",
						},
					});
				}
			}

			return updatedApp;
		} else {
			// REJECTED
			const updatedApp = await tx.roleApplication.update({
				where: { id: applicationId },
				data: {
					status: ApplicationStatus.REJECTED,
					reviewedBy: adminUserId,
					reviewedAt: new Date(),
					rejectionReason:
						payload.rejectionReason ||
						"Your application was not approved at this time.",
				},
			});

			return updatedApp;
		}
	});
};

const getActiveHubs = async () => {
	const hubs = await prisma.hub.findMany({
		where: { isActive: true },
		select: {
			id: true,
			name: true,
			code: true,
			address: true,
			zone: {
				select: {
					id: true,
					name: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});

	return hubs;
};

export const RoleApplicationService = {
	applyForRole,
	getMyApplications,
	getAllApplications,
	getApplicationById,
	reviewApplication,
	getActiveHubs,
};
