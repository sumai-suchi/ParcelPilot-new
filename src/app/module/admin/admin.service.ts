import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	AttemptStatus,
	CourierAvailability,
	PaymentStatus,
	ShipmentStatus,
	UserRole,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IAdminPaymentFilterQuery,
	IAdminShipmentFilterQuery,
	IAdminUserFilterQuery,
	ICreateHubPayload,
	ICreatePricingRulePayload,
	ICreateStaffUserPayload,
	ICreateZonePayload,
	IUpdateHubPayload,
	IUpdatePricingRulePayload,
	IUpdateUserPayload,
	IUpdateZonePayload,
} from "./admin.interface";

// ==========================================
// 1. Dashboard Overview & Real-Time Metrics
// ==========================================

const getDashboardOverview = async () => {
	const [
		revenueResult,
		totalShipments,
		shipmentStatusCounts,
		userRoleCounts,
		totalHubs,
		totalZones,
		recentActivities,
	] = await Promise.all([
		prisma.payment.aggregate({
			where: { status: PaymentStatus.PAID },
			_sum: { amount: true },
		}),
		prisma.shipment.count(),
		prisma.shipment.groupBy({
			by: ["status"],
			_count: true,
		}),
		prisma.user.groupBy({
			by: ["role"],
			_count: true,
		}),
		prisma.hub.count({ where: { isActive: true } }),
		prisma.zone.count({ where: { isActive: true } }),
		prisma.shipmentStatusHistory.findMany({
			take: 8,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: {
					select: {
						id: true,
						trackingNumber: true,
						status: true,
					},
				},
				updater: {
					select: {
						id: true,
						name: true,
						role: true,
					},
				},
			},
		}),
	]);

	const shipmentsByStatus: Record<string, number> = {};
	for (const item of shipmentStatusCounts) {
		shipmentsByStatus[item.status] = item._count;
	}

	const usersByRole: Record<string, number> = {};
	for (const item of userRoleCounts) {
		usersByRole[item.role] = item._count;
	}

	return {
		totalRevenue: Number(revenueResult._sum.amount || 0),
		currency: config.stripe_currency?.toUpperCase() || "BDT",
		totalShipments,
		shipmentsByStatus,
		usersByRole,
		infrastructure: {
			activeHubs: totalHubs,
			activeZones: totalZones,
		},
		recentActivities,
	};
};

// ==========================================
// 2. User & Workforce Governance
// ==========================================

const getAllUsers = async (query: IAdminUserFilterQuery) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.UserWhereInput = {};

	if (query.role) {
		whereConditions.role = query.role;
	}

	if (query.status) {
		whereConditions.status = query.status;
	}

	if (query.searchTerm) {
		whereConditions.OR = [
			{ name: { contains: query.searchTerm, mode: "insensitive" } },
			{ email: { contains: query.searchTerm, mode: "insensitive" } },
			{ phone: { contains: query.searchTerm, mode: "insensitive" } },
		];
	}

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			omit: { password: true },
			include: {
				customer: true,
				courier: {
					include: {
						hub: {
							select: { id: true, name: true, code: true },
						},
					},
				},
			},
		}),
		prisma.user.count({ where: whereConditions }),
	]);

	return {
		data: users,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getCustomers = async (query: IAdminUserFilterQuery) => {
	return getAllUsers({ ...query, role: UserRole.CUSTOMER });
};

const getCouriers = async (query: IAdminUserFilterQuery) => {
	return getAllUsers({ ...query, role: UserRole.COURIER });
};

const getHubManagers = async (query: IAdminUserFilterQuery) => {
	return getAllUsers({ ...query, role: UserRole.HUB_MANAGER });
};

const getOperationsManagers = async (query: IAdminUserFilterQuery) => {
	return getAllUsers({ ...query, role: UserRole.OPERATIONS_MANAGER });
};

const getUserById = async (id: string) => {
	const user = await prisma.user.findUnique({
		where: { id },
		omit: { password: true },
		include: {
			customer: {
				include: {
					addresses: true,
					shipments: {
						take: 5,
						orderBy: { createdAt: "desc" },
					},
				},
			},
			courier: {
				include: {
					hub: true,
					assignments: {
						take: 5,
						orderBy: { assignedAt: "desc" },
					},
				},
			},
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	return user;
};

const createStaffUser = async (payload: ICreateStaffUserPayload) => {
	const existingUser = await prisma.user.findFirst({
		where: {
			OR: [
				{ email: payload.email.toLowerCase() },
				...(payload.phone ? [{ phone: payload.phone }] : []),
			],
		},
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email or phone already exists.",
		);
	}

	const saltRounds = Number(config.bcrypt_salt_rounds) || 10;
	const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

	if (payload.role === UserRole.COURIER) {
		if (!payload.hubId) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Hub assignment is required when creating a courier account.",
			);
		}

		const hub = await prisma.hub.findUnique({ where: { id: payload.hubId } });
		if (!hub) {
			throw new AppError(httpStatus.NOT_FOUND, "Assigned Hub not found.");
		}

		const newUser = await prisma.user.create({
			data: {
				name: payload.name,
				email: payload.email.toLowerCase(),
				password: hashedPassword,
				phone: payload.phone || null,
				role: UserRole.COURIER,
				status: UserStatus.ACTIVE,
				emailVerified: true,
				courier: {
					create: {
						hubId: hub.id,
						vehicleType: payload.vehicleType || "Motorcycle",
						vehicleNumber: payload.vehicleNumber || "PENDING-REG",
						availabilityStatus: CourierAvailability.AVAILABLE,
					},
				},
			},
			omit: { password: true },
			include: { courier: { include: { hub: true } } },
		});

		return newUser;
	}

	const newUser = await prisma.user.create({
		data: {
			name: payload.name,
			email: payload.email.toLowerCase(),
			password: hashedPassword,
			phone: payload.phone || null,
			role: payload.role,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
		omit: { password: true },
	});

	return newUser;
};

const updateUser = async (id: string, payload: IUpdateUserPayload) => {
	const user = await prisma.user.findUnique({ where: { id } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	const updated = await prisma.user.update({
		where: { id },
		data: {
			...(payload.name ? { name: payload.name } : {}),
			...(payload.phone !== undefined ? { phone: payload.phone } : {}),
			...(payload.status ? { status: payload.status } : {}),
			...(payload.role ? { role: payload.role } : {}),
		},
		omit: { password: true },
	});

	return updated;
};

const deleteUser = async (id: string) => {
	const user = await prisma.user.findUnique({ where: { id } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	// Soft-deactivate user account
	const deactivated = await prisma.user.update({
		where: { id },
		data: { status: UserStatus.INACTIVE },
		omit: { password: true },
	});

	return deactivated;
};

// ==========================================
// 3. Logistics Infrastructure (Hubs & Zones)
// ==========================================

const getAllZones = async () => {
	const zones = await prisma.zone.findMany({
		include: {
			_count: {
				select: { hubs: true, pricingRules: true },
			},
		},
		orderBy: { name: "asc" },
	});

	return zones;
};

const createZone = async (payload: ICreateZonePayload) => {
	const existing = await prisma.zone.findUnique({
		where: { code: payload.code.toUpperCase() },
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Zone with code '${payload.code}' already exists.`,
		);
	}

	const zone = await prisma.zone.create({
		data: {
			name: payload.name,
			code: payload.code.toUpperCase(),
			isActive: true,
		},
	});

	return zone;
};

const updateZone = async (id: string, payload: IUpdateZonePayload) => {
	const zone = await prisma.zone.findUnique({ where: { id } });

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found.");
	}

	const updated = await prisma.zone.update({
		where: { id },
		data: {
			...(payload.name ? { name: payload.name } : {}),
			...(payload.code ? { code: payload.code.toUpperCase() } : {}),
			...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
		},
	});

	return updated;
};

const deleteZone = async (id: string) => {
	const zone = await prisma.zone.findUnique({ where: { id } });

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found.");
	}

	const deactivated = await prisma.zone.update({
		where: { id },
		data: { isActive: false },
	});

	return deactivated;
};

const getAllHubs = async () => {
	const hubs = await prisma.hub.findMany({
		include: {
			zone: true,
			_count: {
				select: {
					couriers: true,
					originShipments: true,
					destinationShipments: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});

	return hubs;
};

const createHub = async (payload: ICreateHubPayload) => {
	const existing = await prisma.hub.findUnique({
		where: { code: payload.code.toUpperCase() },
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Hub with code '${payload.code}' already exists.`,
		);
	}

	const zone = await prisma.zone.findUnique({ where: { id: payload.zoneId } });
	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found.");
	}

	const hub = await prisma.hub.create({
		data: {
			name: payload.name,
			code: payload.code.toUpperCase(),
			zoneId: payload.zoneId,
			address: payload.address,
			phone: payload.phone || null,
			isActive: true,
		},
		include: { zone: true },
	});

	return hub;
};

const bulkCreateHubs = async (items: any[]) => {
	if (!Array.isArray(items) || items.length === 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Expected a non-empty array of hub items.",
		);
	}

	const results = [];
	let createdCount = 0;
	let updatedCount = 0;

	for (const item of items) {
		// Grouped format: { zoneName, zoneCode, hubs: [...] }
		if (Array.isArray(item.hubs) && item.zoneCode) {
			const zoneCode = item.zoneCode.toUpperCase().trim();
			const zoneName = item.zoneName || zoneCode;

			const zone = await prisma.zone.upsert({
				where: { code: zoneCode },
				update: { name: zoneName, isActive: true },
				create: { code: zoneCode, name: zoneName, isActive: true },
			});

			for (const hub of item.hubs) {
				const hubCode = hub.code.toUpperCase().trim();
				const existing = await prisma.hub.findUnique({
					where: { code: hubCode },
				});

				const savedHub = await prisma.hub.upsert({
					where: { code: hubCode },
					update: {
						name: hub.name,
						zoneId: zone.id,
						address: hub.address,
						phone: hub.phone || null,
						isActive: hub.isActive !== false,
					},
					create: {
						name: hub.name,
						code: hubCode,
						zoneId: zone.id,
						address: hub.address,
						phone: hub.phone || null,
						isActive: hub.isActive !== false,
					},
					include: { zone: true },
				});

				if (existing) updatedCount++;
				else createdCount++;
				results.push(savedHub);
			}
			continue;
		}

		// Flat format: { name, code, zoneCode, zoneName, address, phone }
		if (item.name && item.code && item.address) {
			let zoneId = item.zoneId;

			if (!zoneId && item.zoneCode) {
				const zoneCode = item.zoneCode.toUpperCase().trim();
				const zoneName = item.zoneName || zoneCode;
				const zone = await prisma.zone.upsert({
					where: { code: zoneCode },
					update: { name: zoneName, isActive: true },
					create: { code: zoneCode, name: zoneName, isActive: true },
				});
				zoneId = zone.id;
			}

			if (!zoneId) {
				const firstZone = await prisma.zone.findFirst();
				if (firstZone) {
					zoneId = firstZone.id;
				} else {
					const defaultZone = await prisma.zone.create({
						data: {
							code: "ZONE-DEFAULT",
							name: "General Logistics Zone",
							isActive: true,
						},
					});
					zoneId = defaultZone.id;
				}
			}

			const hubCode = item.code.toUpperCase().trim();
			const existing = await prisma.hub.findUnique({
				where: { code: hubCode },
			});

			const savedHub = await prisma.hub.upsert({
				where: { code: hubCode },
				update: {
					name: item.name,
					zoneId,
					address: item.address,
					phone: item.phone || null,
					isActive: item.isActive !== false,
				},
				create: {
					name: item.name,
					code: hubCode,
					zoneId,
					address: item.address,
					phone: item.phone || null,
					isActive: item.isActive !== false,
				},
				include: { zone: true },
			});

			if (existing) updatedCount++;
			else createdCount++;
			results.push(savedHub);
		}
	}

	return {
		totalProcessed: results.length,
		createdCount,
		updatedCount,
		hubs: results,
	};
};

const updateHub = async (id: string, payload: IUpdateHubPayload) => {
	const hub = await prisma.hub.findUnique({ where: { id } });

	if (!hub) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");
	}

	const updated = await prisma.hub.update({
		where: { id },
		data: {
			...(payload.name ? { name: payload.name } : {}),
			...(payload.code ? { code: payload.code.toUpperCase() } : {}),
			...(payload.zoneId ? { zoneId: payload.zoneId } : {}),
			...(payload.address ? { address: payload.address } : {}),
			...(payload.phone !== undefined ? { phone: payload.phone } : {}),
			...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
		},
		include: { zone: true },
	});

	return updated;
};

const deleteHub = async (id: string) => {
	const hub = await prisma.hub.findUnique({ where: { id } });

	if (!hub) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");
	}

	const deactivated = await prisma.hub.update({
		where: { id },
		data: { isActive: false },
	});

	return deactivated;
};

// ==========================================
// 4. Pricing Rules Administration
// ==========================================

const getAllPricingRules = async () => {
	const rules = await prisma.pricingRule.findMany({
		include: { zone: true },
		orderBy: { createdAt: "desc" },
	});

	return rules;
};

const createPricingRule = async (payload: ICreatePricingRulePayload) => {
	const zone = await prisma.zone.findUnique({ where: { id: payload.zoneId } });
	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found.");
	}

	const rule = await prisma.pricingRule.create({
		data: {
			zoneId: payload.zoneId,
			deliveryType: payload.deliveryType || "STANDARD",
			minWeight: payload.minWeight || 0.0,
			maxWeight: payload.maxWeight,
			baseCharge: payload.baseCharge,
			perKgCharge: payload.perKgCharge || 0.0,
			isActive: true,
		},
		include: { zone: true },
	});

	return rule;
};

const updatePricingRule = async (
	id: string,
	payload: IUpdatePricingRulePayload,
) => {
	const existing = await prisma.pricingRule.findUnique({ where: { id } });
	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Pricing rule not found.");
	}

	const updated = await prisma.pricingRule.update({
		where: { id },
		data: {
			...(payload.minWeight !== undefined
				? { minWeight: payload.minWeight }
				: {}),
			...(payload.maxWeight !== undefined
				? { maxWeight: payload.maxWeight }
				: {}),
			...(payload.baseCharge !== undefined
				? { baseCharge: payload.baseCharge }
				: {}),
			...(payload.perKgCharge !== undefined
				? { perKgCharge: payload.perKgCharge }
				: {}),
			...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
		},
		include: { zone: true },
	});

	return updated;
};

const deletePricingRule = async (id: string) => {
	const existing = await prisma.pricingRule.findUnique({ where: { id } });
	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Pricing rule not found.");
	}

	const deactivated = await prisma.pricingRule.update({
		where: { id },
		data: { isActive: false },
	});

	return deactivated;
};

// ==========================================
// 5. Global Shipments & Payments Oversight
// ==========================================

const getAllShipments = async (query: IAdminShipmentFilterQuery) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.ShipmentWhereInput = {};

	if (query.status) {
		whereConditions.status = query.status;
	}

	if (query.paymentStatus) {
		whereConditions.paymentStatus = query.paymentStatus;
	}

	if (query.originHubId) {
		whereConditions.originHubId = query.originHubId;
	}

	if (query.destinationHubId) {
		whereConditions.destinationHubId = query.destinationHubId;
	}

	if (query.searchTerm) {
		whereConditions.OR = [
			{ trackingNumber: { contains: query.searchTerm, mode: "insensitive" } },
			{ description: { contains: query.searchTerm, mode: "insensitive" } },
		];
	}

	const [shipments, total] = await Promise.all([
		prisma.shipment.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				originHub: true,
				destinationHub: true,
				pickupAddress: true,
				deliveryAddress: true,
				payment: true,
				customer: {
					include: {
						user: {
							select: { id: true, name: true, email: true, phone: true },
						},
					},
				},
			},
		}),
		prisma.shipment.count({ where: whereConditions }),
	]);

	return {
		data: shipments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getAllPayments = async (query: IAdminPaymentFilterQuery) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.PaymentWhereInput = {};

	if (query.status) {
		whereConditions.status = query.status;
	}

	if (query.provider) {
		whereConditions.provider = query.provider;
	}

	if (query.searchTerm) {
		whereConditions.OR = [
			{ transactionId: { contains: query.searchTerm, mode: "insensitive" } },
			{
				shipment: {
					trackingNumber: { contains: query.searchTerm, mode: "insensitive" },
				},
			},
		];
	}

	const [payments, total] = await Promise.all([
		prisma.payment.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: {
					select: {
						id: true,
						trackingNumber: true,
						status: true,
						deliveryCharge: true,
					},
				},
			},
		}),
		prisma.payment.count({ where: whereConditions }),
	]);

	return {
		data: payments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

// ==========================================
// 6. Analytics & Performance Reporting
// ==========================================

const getRevenueAnalytics = async () => {
	const [paidSummary, providerBreakdown] = await Promise.all([
		prisma.payment.aggregate({
			where: { status: PaymentStatus.PAID },
			_sum: { amount: true },
			_count: true,
		}),
		prisma.payment.groupBy({
			by: ["provider"],
			where: { status: PaymentStatus.PAID },
			_sum: { amount: true },
			_count: true,
		}),
	]);

	return {
		totalPaidRevenue: Number(paidSummary._sum.amount || 0),
		totalPaidTransactions: paidSummary._count,
		breakdownByProvider: providerBreakdown.map((item) => ({
			provider: item.provider,
			totalRevenue: Number(item._sum.amount || 0),
			transactionsCount: item._count,
		})),
	};
};

const getPerformanceAnalytics = async () => {
	const [
		totalAttempts,
		successAttempts,
		failedAttempts,
		deliveredShipments,
		failedShipments,
	] = await Promise.all([
		prisma.deliveryAttempt.count(),
		prisma.deliveryAttempt.count({ where: { status: AttemptStatus.SUCCESS } }),
		prisma.deliveryAttempt.count({ where: { status: AttemptStatus.FAILED } }),
		prisma.shipment.count({ where: { status: ShipmentStatus.DELIVERED } }),
		prisma.shipment.count({
			where: { status: ShipmentStatus.DELIVERY_FAILED },
		}),
	]);

	const successRate =
		totalAttempts > 0
			? ((successAttempts / totalAttempts) * 100).toFixed(2)
			: "0.00";

	return {
		totalDeliveryAttempts: totalAttempts,
		successfulAttempts: successAttempts,
		failedAttempts,
		deliverySuccessRatePercent: `${successRate}%`,
		deliveredShipmentsCount: deliveredShipments,
		currentlyFailedShipmentsCount: failedShipments,
	};
};

const getHubVolumeReport = async () => {
	const hubs = await prisma.hub.findMany({
		where: { isActive: true },
		include: {
			_count: {
				select: {
					originShipments: true,
					destinationShipments: true,
					transfersFrom: true,
					transfersTo: true,
					couriers: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});

	return hubs.map((hub) => ({
		hubId: hub.id,
		name: hub.name,
		code: hub.code,
		activeCouriers: hub._count.couriers,
		inboundDispatched: hub._count.originShipments,
		outboundDeliveries: hub._count.destinationShipments,
		transfersDispatched: hub._count.transfersFrom,
		transfersReceived: hub._count.transfersTo,
	}));
};

const getSettings = async () => {
	return {
		environment: config.node_env || "development",
		currency: config.stripe_currency?.toUpperCase() || "BDT",
		stripeConfigured: Boolean(config.stripe_secret_key),
		redisConfigured: Boolean(config.redis_host),
		emailSenderConfigured: Boolean(config.email_sender),
		backendUrl: config.bak_url,
		frontendUrl: config.frontend_url,
	};
};

export const AdminService = {
	getDashboardOverview,
	getAllUsers,
	getCustomers,
	getCouriers,
	getHubManagers,
	getOperationsManagers,
	getUserById,
	createStaffUser,
	updateUser,
	deleteUser,
	getAllZones,
	createZone,
	updateZone,
	deleteZone,
	getAllHubs,
	createHub,
	bulkCreateHubs,
	updateHub,
	deleteHub,
	getAllPricingRules,
	createPricingRule,
	updatePricingRule,
	deletePricingRule,
	getAllShipments,
	getAllPayments,
	getRevenueAnalytics,
	getPerformanceAnalytics,
	getHubVolumeReport,
	getSettings,
};
