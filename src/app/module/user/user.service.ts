import crypto from "node:crypto";
import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	AssignmentStatus,
	PaymentStatus,
	ShipmentStatus,
	UserRole,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICalculatePricingPayload,
	ICancelShipmentPayload,
	ICreateAddressPayload,
	ICreateShipmentRequestPayload,
	IDeliveryHistoryQuery,
	IInvoiceQuery,
	IReportDeliveryIssuePayload,
	ISchedulePickupPayload,
	IShipmentFilterQuery,
	IUpdateAddressPayload,
	IUpdateProfilePayload,
	IUpdateUserStatusPayload,
	IUserFilterQuery,
} from "./user.interface";

/**
 * Helper: Find Customer profile by User ID
 */
const getCustomerByUserId = async (userId: string) => {
	let customer = await prisma.customer.findUnique({
		where: {
			userId,
		},
	});

	if (!customer) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (user && user.role === UserRole.CUSTOMER) {
			customer = await prisma.customer.create({
				data: {
					userId,
				},
			});
		} else {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"Customer profile not found for this user account.",
			);
		}
	}

	return customer;
};

// ==========================================
// User Profile & Management Services
// ==========================================

const getProfile = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: {
			id: userId,
		},
		omit: {
			password: true,
		},
		include: {
			customer: {
				include: {
					addresses: {
						orderBy: {
							createdAt: "desc",
						},
					},
				},
			},
			courier: {
				include: {
					hub: true,
				},
			},
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	return user;
};

const updateProfile = async (
	userId: string,
	payload: IUpdateProfilePayload,
) => {
	const { name, phone, profilePicture } = payload;

	const existingUser = await prisma.user.findUnique({
		where: {
			id: userId,
		},
	});

	if (!existingUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	if (phone && phone !== existingUser.phone) {
		const phoneConflict = await prisma.user.findFirst({
			where: {
				phone,
				NOT: {
					id: userId,
				},
			},
		});

		if (phoneConflict) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Phone number is already associated with another account.",
			);
		}
	}

	const updatedUser = await prisma.user.update({
		where: {
			id: userId,
		},
		data: {
			...(name ? { name } : {}),
			...(phone ? { phone } : {}),
			...(profilePicture !== undefined ? { profilePicture } : {}),
		},
		omit: {
			password: true,
		},
	});

	return updatedUser;
};

const getAllUsers = async (query: IUserFilterQuery) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
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

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			omit: {
				password: true,
			},
			include: {
				customer: true,
				courier: true,
			},
		}),
		prisma.user.count({
			where: whereConditions,
		}),
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

const getUserById = async (id: string) => {
	const user = await prisma.user.findUnique({
		where: {
			id,
		},
		omit: {
			password: true,
		},
		include: {
			customer: {
				include: {
					addresses: true,
				},
			},
			courier: {
				include: {
					hub: true,
				},
			},
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	return user;
};

const updateUserStatus = async (
	id: string,
	payload: IUpdateUserStatusPayload,
) => {
	const existingUser = await prisma.user.findUnique({
		where: {
			id,
		},
	});

	if (!existingUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	const updatedUser = await prisma.user.update({
		where: {
			id,
		},
		data: {
			...(payload.status ? { status: payload.status } : {}),
			...(payload.role ? { role: payload.role } : {}),
		},
		omit: {
			password: true,
		},
	});

	return updatedUser;
};

// ==========================================
// Customer Address Management Services
// ==========================================

const addAddress = async (userId: string, payload: ICreateAddressPayload) => {
	const customer = await getCustomerByUserId(userId);

	const address = await prisma.address.create({
		data: {
			customerId: customer.id,
			label: payload.label || null,
			addressLine: payload.addressLine,
			city: payload.city,
			area: payload.area,
			postalCode: payload.postalCode || null,
			latitude: payload.latitude !== undefined ? payload.latitude : null,
			longitude: payload.longitude !== undefined ? payload.longitude : null,
		},
	});

	return address;
};

const getMyAddresses = async (userId: string) => {
	const customer = await getCustomerByUserId(userId);

	const addresses = await prisma.address.findMany({
		where: {
			customerId: customer.id,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return addresses;
};

const getAddressById = async (
	userId: string,
	addressId: string,
	role: UserRole,
) => {
	const address = await prisma.address.findUnique({
		where: {
			id: addressId,
		},
	});

	if (!address) {
		throw new AppError(httpStatus.NOT_FOUND, "Address not found.");
	}

	if (role !== UserRole.ADMIN && role !== UserRole.OPERATIONS_MANAGER) {
		const customer = await getCustomerByUserId(userId);
		if (address.customerId !== customer.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have access to this address.",
			);
		}
	}

	return address;
};

const updateAddress = async (
	userId: string,
	addressId: string,
	payload: IUpdateAddressPayload,
	role: UserRole,
) => {
	const address = await prisma.address.findUnique({
		where: {
			id: addressId,
		},
	});

	if (!address) {
		throw new AppError(httpStatus.NOT_FOUND, "Address not found.");
	}

	if (role !== UserRole.ADMIN && role !== UserRole.OPERATIONS_MANAGER) {
		const customer = await getCustomerByUserId(userId);
		if (address.customerId !== customer.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You cannot update an address that does not belong to you.",
			);
		}
	}

	const updatedAddress = await prisma.address.update({
		where: {
			id: addressId,
		},
		data: {
			...(payload.label !== undefined ? { label: payload.label } : {}),
			...(payload.addressLine ? { addressLine: payload.addressLine } : {}),
			...(payload.city ? { city: payload.city } : {}),
			...(payload.area ? { area: payload.area } : {}),
			...(payload.postalCode !== undefined
				? { postalCode: payload.postalCode }
				: {}),
			...(payload.latitude !== undefined ? { latitude: payload.latitude } : {}),
			...(payload.longitude !== undefined
				? { longitude: payload.longitude }
				: {}),
		},
	});

	return updatedAddress;
};

const deleteAddress = async (
	userId: string,
	addressId: string,
	role: UserRole,
) => {
	const address = await prisma.address.findUnique({
		where: {
			id: addressId,
		},
	});

	if (!address) {
		throw new AppError(httpStatus.NOT_FOUND, "Address not found.");
	}

	if (role !== UserRole.ADMIN && role !== UserRole.OPERATIONS_MANAGER) {
		const customer = await getCustomerByUserId(userId);
		if (address.customerId !== customer.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You cannot delete an address that does not belong to you.",
			);
		}
	}

	await prisma.address.delete({
		where: {
			id: addressId,
		},
	});

	return { message: "Address deleted successfully." };
};

// ==========================================
// Customer Shipment Request Services
// ==========================================

/**
 * Creates a shipment request for the authenticated Customer.
 * When the customer creates a shipment request, they must fill/add address information
 * which will be saved in the database under that customer.
 */
const createShipmentRequest = async (
	userId: string,
	payload: ICreateShipmentRequestPayload,
) => {
	// 1. Ensure user has an active Customer profile
	const customer = await getCustomerByUserId(userId);

	// 2. Edge Case: Weight Validation (Zero, Negative, NaN, or Excessively Large)
	if (
		typeof payload.weight !== "number" ||
		Number.isNaN(payload.weight) ||
		!Number.isFinite(payload.weight)
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid parcel weight. Weight must be a valid positive number.",
		);
	}

	if (payload.weight <= 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid parcel weight. Zero or negative weight is not allowed. Weight must be greater than zero.",
		);
	}

	if (payload.weight < 0.05) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Minimum parcel weight is 0.05 kg (50 grams).",
		);
	}

	if (payload.weight > 500) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Maximum parcel weight allowed is 500 kg. For heavier cargo, please contact freight support.",
		);
	}

	// 3. Edge Case: Recipient Phone Validation
	if (payload.recipientPhone) {
		const phoneRegex = /^(?:\+?8801[3-9]\d{8}|01[3-9]\d{8}|\+?[1-9]\d{7,14})$/;
		if (!phoneRegex.test(payload.recipientPhone.trim())) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Invalid recipient phone number format. Please provide a valid phone number (e.g., +8801XXXXXXXXX or 01XXXXXXXXX).",
			);
		}
	}

	// 4. Edge Case: Missing Addresses Validation
	if (!payload.pickupAddress && !payload.pickupAddressId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing pickup address. Please provide either 'pickupAddress' details or a saved 'pickupAddressId'.",
		);
	}

	if (!payload.deliveryAddress && !payload.deliveryAddressId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing delivery address. Please provide either 'deliveryAddress' details or a saved 'deliveryAddressId'.",
		);
	}

	// Validate incomplete address fields if full address object was provided
	if (payload.pickupAddress) {
		if (
			!payload.pickupAddress.addressLine?.trim() ||
			!payload.pickupAddress.city?.trim() ||
			!payload.pickupAddress.area?.trim()
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Incomplete pickup address. 'addressLine', 'city', and 'area' are required fields.",
			);
		}
	}

	if (payload.deliveryAddress) {
		if (
			!payload.deliveryAddress.addressLine?.trim() ||
			!payload.deliveryAddress.city?.trim() ||
			!payload.deliveryAddress.area?.trim()
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Incomplete delivery address. 'addressLine', 'city', and 'area' are required fields.",
			);
		}
	}

	// 5. Resolve and validate existing saved address IDs if passed
	let pickupCity = "";
	let pickupArea = "";
	let pickupLine = "";

	if (payload.pickupAddressId) {
		const existingPickup = await prisma.address.findUnique({
			where: { id: payload.pickupAddressId },
		});
		if (!existingPickup) {
			throw new AppError(httpStatus.NOT_FOUND, "Specified pickup address ID not found.");
		}
		if (existingPickup.customerId !== customer.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Specified pickup address does not belong to your account.",
			);
		}
		pickupCity = existingPickup.city.trim();
		pickupArea = existingPickup.area.trim();
		pickupLine = existingPickup.addressLine.trim();
	} else if (payload.pickupAddress) {
		pickupCity = payload.pickupAddress.city.trim();
		pickupArea = payload.pickupAddress.area.trim();
		pickupLine = payload.pickupAddress.addressLine.trim();
	}

	let deliveryCity = "";
	let deliveryArea = "";
	let deliveryLine = "";

	if (payload.deliveryAddressId) {
		const existingDelivery = await prisma.address.findUnique({
			where: { id: payload.deliveryAddressId },
		});
		if (!existingDelivery) {
			throw new AppError(httpStatus.NOT_FOUND, "Specified delivery address ID not found.");
		}
		deliveryCity = existingDelivery.city.trim();
		deliveryArea = existingDelivery.area.trim();
		deliveryLine = existingDelivery.addressLine.trim();
	} else if (payload.deliveryAddress) {
		deliveryCity = payload.deliveryAddress.city.trim();
		deliveryArea = payload.deliveryAddress.area.trim();
		deliveryLine = payload.deliveryAddress.addressLine.trim();
	}

	// Edge Case: Identical Pickup & Delivery Address
	if (
		pickupCity.toLowerCase() === deliveryCity.toLowerCase() &&
		pickupArea.toLowerCase() === deliveryArea.toLowerCase() &&
		pickupLine.toLowerCase() === deliveryLine.toLowerCase()
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Pickup address and delivery address cannot be identical. Parcel cannot be delivered to the exact same location.",
		);
	}

	// 6. Edge Case: Unsupported Delivery Zone Check
	const activeZones = await prisma.zone.findMany({
		where: { isActive: true },
		include: {
			hubs: {
				where: { isActive: true },
				select: { id: true, name: true, address: true, code: true },
			},
		},
	});

	if (activeZones.length > 0) {
		const targetCity = deliveryCity.toLowerCase();
		const targetArea = deliveryArea.toLowerCase();

		const isSupported = activeZones.some((zone) => {
			const zName = zone.name.toLowerCase();
			const zCode = zone.code.toLowerCase();
			const zoneNameMatch = zName.includes(targetCity) || targetCity.includes(zName);
			const zoneCodeMatch = zCode.includes(targetCity) || targetCity.includes(zCode);
			const hubMatch = zone.hubs.some(
				(hub) => {
					const hAddr = hub.address.toLowerCase();
					const hName = hub.name.toLowerCase();
					return (
						hAddr.includes(targetCity) ||
						targetCity.includes(hAddr) ||
						hAddr.includes(targetArea) ||
						targetArea.includes(hAddr) ||
						hName.includes(targetCity) ||
						targetCity.includes(hName)
					);
				},
			);
			return zoneNameMatch || zoneCodeMatch || hubMatch;
		});

		if (!isSupported) {
			const supportedZoneNames = activeZones.map((z) => z.name).join(", ");
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Unsupported delivery zone: '${deliveryCity}'. ParcelPilot currently only delivers to serviced regions: ${supportedZoneNames}.`,
			);
		}
	}

	// 7. Edge Case: Duplicate Shipment Submission Detection (within last 2 minutes)
	const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
	const duplicateShipment = await prisma.shipment.findFirst({
		where: {
			customerId: customer.id,
			parcelType: payload.parcelType,
			weight: payload.weight,
			status: {
				in: [ShipmentStatus.PENDING_APPROVAL, ShipmentStatus.CREATED],
			},
			createdAt: {
				gte: twoMinutesAgo,
			},
			deliveryAddress: {
				city: { equals: deliveryCity, mode: "insensitive" },
				addressLine: { equals: deliveryLine, mode: "insensitive" },
			},
		},
	});

	if (duplicateShipment) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Duplicate shipment submission detected. An identical shipment request was just submitted within the last 2 minutes (Tracking Number: ${duplicateShipment.trackingNumber}). Please wait before submitting again.`,
		);
	}

	// 8. Generate Tracking Number: PP-YYYYMMDD-XXXXXX
	const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
	const trackingNumber = `PP-${datePart}-${randomPart}`;

	const deliveryType = payload.deliveryType || "STANDARD";
	let deliveryCharge = 100.0; // Default baseline charge for STANDARD (minimum 100 BDT)
	const matchingRule = await prisma.pricingRule.findFirst({
		where: {
			isActive: true,
			deliveryType,
			minWeight: { lte: payload.weight },
			maxWeight: { gte: payload.weight },
		},
	});
	if (matchingRule) {
		const base = Number(matchingRule.baseCharge);
		const perKg = Number(matchingRule.perKgCharge);
		const minW = Number(matchingRule.minWeight);
		const extra = Math.max(0, payload.weight - minW);
		deliveryCharge = Number((base + extra * perKg).toFixed(2));
	} else {
		let base = 100.0;
		let perKg = 20.0;
		if (deliveryType === "EXPRESS") {
			base = 150.0;
			perKg = 35.0;
		} else if (deliveryType === "SAME_DAY") {
			base = 200.0;
			perKg = 50.0;
		}
		const extra = Math.max(0, payload.weight - 1.0);
		deliveryCharge = Number((base + extra * perKg).toFixed(2));
	}

	// Format description with recipient info if provided
	let formattedDescription = payload.description?.trim() || "";
	if (payload.recipientPhone || payload.recipientName) {
		const recipientTag = `[Recipient: ${payload.recipientName?.trim() || "N/A"}, Phone: ${payload.recipientPhone?.trim() || "N/A"}]`;
		formattedDescription = formattedDescription
			? `${recipientTag} ${formattedDescription}`
			: recipientTag;
	}

	// 9. Execute transactional creation
	const result = await prisma.$transaction(async (tx) => {
		// Save pickup address for this customer if address details are filled
		let pickupAddressId: string;
		if (payload.pickupAddress) {
			const createdPickup = await tx.address.create({
				data: {
					customerId: customer.id,
					label: payload.pickupAddress.label || "Pickup Address",
					addressLine: payload.pickupAddress.addressLine.trim(),
					city: payload.pickupAddress.city.trim(),
					area: payload.pickupAddress.area.trim(),
					postalCode: payload.pickupAddress.postalCode || null,
					latitude:
						payload.pickupAddress.latitude !== undefined
							? payload.pickupAddress.latitude
							: null,
					longitude:
						payload.pickupAddress.longitude !== undefined
							? payload.pickupAddress.longitude
							: null,
				},
			});
			pickupAddressId = createdPickup.id;
		} else if (payload.pickupAddressId) {
			pickupAddressId = payload.pickupAddressId;
		} else {
			throw new AppError(httpStatus.BAD_REQUEST, "Pickup address is required.");
		}

		// Save delivery address for this customer if address details are filled
		let deliveryAddressId: string;
		if (payload.deliveryAddress) {
			const createdDelivery = await tx.address.create({
				data: {
					customerId: customer.id,
					label: payload.deliveryAddress.label || "Delivery Address",
					addressLine: payload.deliveryAddress.addressLine.trim(),
					city: payload.deliveryAddress.city.trim(),
					area: payload.deliveryAddress.area.trim(),
					postalCode: payload.deliveryAddress.postalCode || null,
					latitude:
						payload.deliveryAddress.latitude !== undefined
							? payload.deliveryAddress.latitude
							: null,
					longitude:
						payload.deliveryAddress.longitude !== undefined
							? payload.deliveryAddress.longitude
							: null,
				},
			});
			deliveryAddressId = createdDelivery.id;
		} else if (payload.deliveryAddressId) {
			deliveryAddressId = payload.deliveryAddressId;
		} else {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Delivery address is required.",
			);
		}

		// Generate secure 6-digit delivery OTP for receiver handover verification
		const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

		// Create Shipment record in PENDING_APPROVAL without assigned hubs
		const createdShipment = await tx.shipment.create({
			data: {
				trackingNumber,
				customerId: customer.id,
				pickupAddressId,
				deliveryAddressId,
				originHubId: null,
				destinationHubId: null,
				parcelType: payload.parcelType.trim(),
				weight: payload.weight,
				description: formattedDescription || null,
				deliveryType,
				deliveryCharge,
				deliveryOtp,
				status: ShipmentStatus.PENDING_APPROVAL,
				paymentStatus: PaymentStatus.PENDING,
				scheduledPickupAt: payload.scheduledPickupAt
					? new Date(payload.scheduledPickupAt)
					: null,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
				customer: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								phone: true,
							},
						},
					},
				},
			},
		});

		// Create initial status history entry with recipient details if present
		const historyNote =
			"Shipment request created by customer, awaiting operational review" +
			(payload.recipientPhone
				? ` (Recipient: ${payload.recipientName?.trim() || "N/A"}, Phone: ${payload.recipientPhone?.trim()})`
				: "");

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId: createdShipment.id,
				status: ShipmentStatus.PENDING_APPROVAL,
				location: null,
				note: historyNote,
				updatedBy: userId,
			},
		});

		return createdShipment;
	});

	return result;
};

const getMyShipments = async (userId: string, query: IShipmentFilterQuery) => {
	const customer = await getCustomerByUserId(userId);

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.ShipmentWhereInput = {
		customerId: customer.id,
	};

	if (query.status) {
		whereConditions.status = query.status as ShipmentStatus;
	}

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const [shipments, total] = await Promise.all([
		prisma.shipment.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: true,
				destinationHub: true,
				statusHistory: {
					orderBy: {
						createdAt: "desc",
					},
				},
			},
		}),
		prisma.shipment.count({
			where: whereConditions,
		}),
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

const getShipmentById = async (
	userId: string,
	shipmentId: string,
	role: UserRole,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: {
			id: shipmentId,
		},
		include: {
			pickupAddress: true,
			deliveryAddress: true,
			originHub: true,
			destinationHub: true,
			payment: true,
			proofOfDelivery: true,
			statusHistory: {
				orderBy: {
					createdAt: "asc",
				},
			},
			customer: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							phone: true,
						},
					},
				},
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (
		role !== UserRole.ADMIN &&
		role !== UserRole.OPERATIONS_MANAGER &&
		role !== UserRole.HUB_MANAGER
	) {
		const customer = await getCustomerByUserId(userId);
		if (shipment.customerId !== customer.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have permission to view this shipment.",
			);
		}
	}

	return shipment;
};

// ==========================================
// Customer Tracking Services
// ==========================================

const trackShipment = async (trackingNumber: string, userId?: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { trackingNumber },
		include: {
			pickupAddress: true,
			deliveryAddress: true,
			originHub: {
				select: { id: true, name: true, code: true, address: true, phone: true },
			},
			destinationHub: {
				select: { id: true, name: true, code: true, address: true, phone: true },
			},
			statusHistory: {
				orderBy: { createdAt: "asc" },
				select: {
					id: true,
					status: true,
					location: true,
					note: true,
					createdAt: true,
				},
			},
			courierAssignments: {
				where: {
					status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.COMPLETED] },
				},
				orderBy: { assignedAt: "desc" },
				take: 1,
				include: {
					courier: {
						include: {
							user: {
								select: { name: true, phone: true },
							},
						},
					},
				},
			},
			deliveryAttempts: {
				orderBy: { attemptNumber: "asc" },
				select: {
					attemptNumber: true,
					status: true,
					failureReason: true,
					notes: true,
					attemptedAt: true,
				},
			},
			proofOfDelivery: {
				select: {
					recipientName: true,
					imageUrl: true,
					signatureUrl: true,
					notes: true,
					createdAt: true,
				},
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment tracking number not found.");
	}

	const activeAssignment = shipment.courierAssignments[0] || null;

	return {
		trackingNumber: shipment.trackingNumber,
		status: shipment.status,
		deliveryType: shipment.deliveryType,
		parcelType: shipment.parcelType,
		weight: Number(shipment.weight),
		deliveryOtp: shipment.deliveryOtp,
		scheduledPickupAt: shipment.scheduledPickupAt,
		createdAt: shipment.createdAt,
		updatedAt: shipment.updatedAt,
		pickupAddress: {
			area: shipment.pickupAddress.area,
			city: shipment.pickupAddress.city,
		},
		deliveryAddress: {
			area: shipment.deliveryAddress.area,
			city: shipment.deliveryAddress.city,
		},
		originHub: shipment.originHub,
		destinationHub: shipment.destinationHub,
		assignedCourier: activeAssignment?.courier?.user
			? {
					name: activeAssignment.courier.user.name,
					phone: activeAssignment.courier.user.phone,
				}
			: null,
		timeline: shipment.statusHistory,
		deliveryAttempts: shipment.deliveryAttempts,
		proofOfDelivery: shipment.proofOfDelivery,
	};
};

// ==========================================
// Customer Pickup Scheduling Services
// ==========================================

const schedulePickup = async (
	userId: string,
	shipmentId: string,
	payload: ISchedulePickupPayload,
) => {
	const customer = await getCustomerByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.customerId !== customer.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only schedule pickup for your own shipments.",
		);
	}

	const eligibleStatuses: ShipmentStatus[] = [
		ShipmentStatus.PENDING_APPROVAL,
		ShipmentStatus.CREATED,
		ShipmentStatus.PICKUP_ASSIGNED,
	];

	if (!eligibleStatuses.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot schedule or reschedule pickup. Current shipment status is '${shipment.status}'.`,
		);
	}

	const scheduledDate = new Date(payload.scheduledPickupAt);
	if (Number.isNaN(scheduledDate.getTime())) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid date format for scheduledPickupAt.",
		);
	}

	if (scheduledDate.getTime() < Date.now() - 5 * 60 * 1000) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Scheduled pickup time must be in the future.",
		);
	}

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				scheduledPickupAt: scheduledDate,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: shipment.status,
				location: "Customer Portal",
				note: `Pickup scheduled for ${scheduledDate.toISOString()}`,
				updatedBy: userId,
			},
		});

		await tx.notification.create({
			data: {
				userId,
				shipmentId,
				title: "Pickup Scheduled",
				message: `Pickup for shipment ${shipment.trackingNumber} is scheduled for ${scheduledDate.toLocaleString()}.`,
				type: "PICKUP_SCHEDULED",
			},
		});

		return updated;
	});

	return updatedShipment;
};

// ==========================================
// Customer Shipment Cancellation Services
// ==========================================

const cancelShipment = async (
	userId: string,
	shipmentId: string,
	payload: ICancelShipmentPayload,
) => {
	const customer = await getCustomerByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.customerId !== customer.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only cancel your own shipments.",
		);
	}

	if (shipment.status === ShipmentStatus.CANCELLED) {
		throw new AppError(httpStatus.BAD_REQUEST, "Shipment is already cancelled.");
	}

	const postPickupStatuses: ShipmentStatus[] = [
		ShipmentStatus.PICKED_UP,
		ShipmentStatus.AT_ORIGIN_HUB,
		ShipmentStatus.IN_TRANSIT,
		ShipmentStatus.AT_DESTINATION_HUB,
		ShipmentStatus.OUT_FOR_DELIVERY,
		ShipmentStatus.DELIVERED,
		ShipmentStatus.DELIVERY_FAILED,
		ShipmentStatus.RESCHEDULED,
		ShipmentStatus.RETURN_INITIATED,
		ShipmentStatus.RETURN_IN_TRANSIT,
		ShipmentStatus.RETURNED,
	];

	if (postPickupStatuses.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment cannot be cancelled after pickup has occurred. Current status is '${shipment.status}'. The package is already in transit with our logistics network. Please contact customer support to request a return or hold.`,
		);
	}

	const cancellableStatuses: ShipmentStatus[] = [
		ShipmentStatus.PENDING_APPROVAL,
		ShipmentStatus.CREATED,
		ShipmentStatus.COURIER_ASSIGNED,
		ShipmentStatus.PICKUP_ASSIGNED,
	];

	if (!cancellableStatuses.includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Shipment cannot be cancelled in its current state ('${shipment.status}').`,
		);
	}

	const cancellationReason =
		payload.reason?.trim() || "Shipment cancelled by customer.";

	const cancelledShipment = await prisma.$transaction(async (tx) => {
		const updated = await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				status: ShipmentStatus.CANCELLED,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
			},
		});

		await tx.courierParcel.updateMany({
			where: {
				shipmentId,
				status: {
					in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED],
				},
			},
			data: {
				status: AssignmentStatus.CANCELLED,
			},
		});

		await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: ShipmentStatus.CANCELLED,
				location: "Customer Portal",
				note: `Cancelled by customer. Reason: ${cancellationReason}`,
				updatedBy: userId,
			},
		});

		await tx.notification.create({
			data: {
				userId,
				shipmentId,
				title: "Shipment Cancelled",
				message: `Shipment ${shipment.trackingNumber} has been successfully cancelled.`,
				type: "SHIPMENT_CANCELLED",
			},
		});

		return updated;
	});

	return cancelledShipment;
};

// ==========================================
// Customer Pricing Services
// ==========================================

const getPricingRules = async () => {
	const rules = await prisma.pricingRule.findMany({
		where: {
			isActive: true,
		},
		include: {
			zone: {
				select: {
					id: true,
					name: true,
					code: true,
				},
			},
		},
		orderBy: [
			{ deliveryType: "asc" },
			{ minWeight: "asc" },
		],
	});

	return rules;
};

const calculatePricing = async (payload: ICalculatePricingPayload) => {
	const weight = Number(payload.weight);
	const deliveryType = (payload.deliveryType || "STANDARD").toUpperCase();

	const whereConditions: Prisma.PricingRuleWhereInput = {
		isActive: true,
		deliveryType,
		minWeight: { lte: weight },
		maxWeight: { gte: weight },
	};

	if (payload.zoneId) {
		whereConditions.zoneId = payload.zoneId;
	}

	const matchedRule = await prisma.pricingRule.findFirst({
		where: whereConditions,
		include: {
			zone: true,
		},
	});

	if (matchedRule) {
		const baseCharge = Number(matchedRule.baseCharge);
		const perKgCharge = Number(matchedRule.perKgCharge);
		const minWeight = Number(matchedRule.minWeight);
		const extraWeight = Math.max(0, weight - minWeight);
		const additionalWeightCharge = Number((extraWeight * perKgCharge).toFixed(2));
		const totalEstimatedCost = Number((baseCharge + additionalWeightCharge).toFixed(2));

		return {
			weight,
			deliveryType,
			currency: "BDT",
			matchedRuleId: matchedRule.id,
			zone: matchedRule.zone?.name || null,
			baseCharge,
			perKgCharge,
			additionalWeightCharge,
			totalEstimatedCost,
		};
	}

	let baseCharge = 100.0;
	let perKgCharge = 20.0;

	if (deliveryType === "EXPRESS") {
		baseCharge = 150.0;
		perKgCharge = 35.0;
	} else if (deliveryType === "SAME_DAY") {
		baseCharge = 200.0;
		perKgCharge = 50.0;
	}

	const extraWeight = Math.max(0, weight - 1.0);
	const additionalWeightCharge = Number((extraWeight * perKgCharge).toFixed(2));
	const totalEstimatedCost = Number((baseCharge + additionalWeightCharge).toFixed(2));

	return {
		weight,
		deliveryType,
		currency: "BDT",
		matchedRuleId: null,
		zone:
			payload.pickupCity &&
			payload.deliveryCity &&
			payload.pickupCity.toLowerCase() === payload.deliveryCity.toLowerCase()
				? "Same City"
				: "Inter-City Standard",
		baseCharge,
		perKgCharge,
		additionalWeightCharge,
		totalEstimatedCost,
		note: "Standard baseline rate estimate.",
	};
};

// ==========================================
// Customer Delivery History Services
// ==========================================

const getDeliveryHistory = async (
	userId: string,
	query: IDeliveryHistoryQuery,
) => {
	const customer = await getCustomerByUserId(userId);

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.ShipmentWhereInput = {
		customerId: customer.id,
	};

	if (query.status) {
		whereConditions.status = query.status as ShipmentStatus;
	} else {
		whereConditions.status = {
			in: [
				ShipmentStatus.DELIVERED,
				ShipmentStatus.RETURNED,
				ShipmentStatus.CANCELLED,
			],
		};
	}

	if (query.startDate || query.endDate) {
		whereConditions.createdAt = {};
		if (query.startDate) {
			whereConditions.createdAt.gte = new Date(query.startDate);
		}
		if (query.endDate) {
			whereConditions.createdAt.lte = new Date(query.endDate);
		}
	}

	const sortBy = query.sortBy || "updatedAt";
	const sortOrder = query.sortOrder || "desc";

	const [history, total] = await Promise.all([
		prisma.shipment.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				pickupAddress: true,
				deliveryAddress: true,
				originHub: { select: { id: true, name: true, code: true } },
				destinationHub: { select: { id: true, name: true, code: true } },
				proofOfDelivery: true,
				payment: true,
				deliveryAttempts: {
					orderBy: { attemptNumber: "desc" },
					take: 1,
				},
				statusHistory: {
					orderBy: { createdAt: "desc" },
					take: 3,
				},
			},
		}),
		prisma.shipment.count({
			where: whereConditions,
		}),
	]);

	return {
		data: history,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

// ==========================================
// Customer Invoice Services
// ==========================================

const getMyInvoices = async (userId: string, query: IInvoiceQuery) => {
	const customer = await getCustomerByUserId(userId);

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
	const skip = (page - 1) * limit;

	const whereConditions: Prisma.ShipmentWhereInput = {
		customerId: customer.id,
	};

	if (query.paymentStatus) {
		whereConditions.paymentStatus = query.paymentStatus as PaymentStatus;
	}

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const [shipments, total] = await Promise.all([
		prisma.shipment.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: {
				payment: true,
				deliveryAddress: true,
			},
		}),
		prisma.shipment.count({
			where: whereConditions,
		}),
	]);

	const invoices = shipments.map((s) => ({
		invoiceNumber: `INV-${s.trackingNumber}`,
		shipmentId: s.id,
		trackingNumber: s.trackingNumber,
		parcelType: s.parcelType,
		weight: Number(s.weight),
		deliveryType: s.deliveryType,
		amount: Number(s.deliveryCharge),
		currency: s.payment?.currency || "BDT",
		paymentStatus: s.paymentStatus,
		paymentProvider: s.payment?.provider || "N/A",
		transactionId: s.payment?.transactionId || null,
		paidAt: s.payment?.paidAt || null,
		invoiceDate: s.createdAt,
		destinationCity: s.deliveryAddress.city,
	}));

	return {
		data: invoices,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getInvoiceById = async (userId: string, identifier: string) => {
	const customer = await getCustomerByUserId(userId);

	const shipment = await prisma.shipment.findFirst({
		where: {
			customerId: customer.id,
			OR: [{ id: identifier }, { trackingNumber: identifier }],
		},
		include: {
			customer: {
				include: {
					user: {
						select: {
							name: true,
							email: true,
							phone: true,
						},
					},
				},
			},
			pickupAddress: true,
			deliveryAddress: true,
			payment: true,
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Invoice not found for this shipment.");
	}

	const deliveryCharge = Number(shipment.deliveryCharge);
	const currency = shipment.payment?.currency || "BDT";

	return {
		invoiceNumber: `INV-${shipment.trackingNumber}`,
		invoiceDate: shipment.createdAt,
		company: {
			name: "ParcelPilot Logistics Ltd.",
			address: "Dhaka, Bangladesh",
			email: "support@parcelpilot.com",
			phone: "+880 1700-000000",
		},
		customer: {
			name: shipment.customer.user.name,
			email: shipment.customer.user.email,
			phone: shipment.customer.user.phone,
		},
		shipmentDetails: {
			shipmentId: shipment.id,
			trackingNumber: shipment.trackingNumber,
			parcelType: shipment.parcelType,
			weight: Number(shipment.weight),
			deliveryType: shipment.deliveryType,
			status: shipment.status,
			pickupAddress: `${shipment.pickupAddress.addressLine}, ${shipment.pickupAddress.area}, ${shipment.pickupAddress.city}`,
			deliveryAddress: `${shipment.deliveryAddress.addressLine}, ${shipment.deliveryAddress.area}, ${shipment.deliveryAddress.city}`,
		},
		billing: {
			baseDeliveryCharge: deliveryCharge,
			tax: 0.0,
			totalAmount: deliveryCharge,
			currency,
			paymentStatus: shipment.paymentStatus,
			paymentProvider: shipment.payment?.provider || "Pending Provider",
			transactionId: shipment.payment?.transactionId || null,
			paidAt: shipment.payment?.paidAt || null,
		},
	};
};

// ==========================================
// Customer Delivery Issue Services
// ==========================================

const reportDeliveryIssue = async (
	userId: string,
	shipmentId: string,
	payload: IReportDeliveryIssuePayload,
) => {
	const customer = await getCustomerByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.customerId !== customer.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only report issues for your own shipments.",
		);
	}

	const contactInfo = payload.contactPhone ? ` (Contact: ${payload.contactPhone})` : "";
	const issueNote = `[ISSUE_REPORTED:${payload.issueType}] ${payload.description}${contactInfo}`;

	const result = await prisma.$transaction(async (tx) => {
		const historyEntry = await tx.shipmentStatusHistory.create({
			data: {
				shipmentId,
				status: shipment.status,
				location: "Customer Issue Report",
				note: issueNote,
				updatedBy: userId,
			},
		});

		await tx.notification.create({
			data: {
				userId,
				shipmentId,
				title: `Delivery Issue Reported: ${shipment.trackingNumber}`,
				message: `Your issue regarding '${payload.issueType}' has been logged and escalated to customer support.`,
				type: "DELIVERY_ISSUE",
			},
		});

		return historyEntry;
	});

	return {
		issueId: result.id,
		shipmentId,
		trackingNumber: shipment.trackingNumber,
		issueType: payload.issueType,
		description: payload.description,
		contactPhone: payload.contactPhone || null,
		reportedAt: result.createdAt,
		status: "OPEN",
		message: "Issue successfully recorded and escalated to operations team.",
	};
};

const getShipmentIssues = async (userId: string, shipmentId: string) => {
	const customer = await getCustomerByUserId(userId);

	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.customerId !== customer.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view issues for your own shipments.",
		);
	}

	const statusHistories = await prisma.shipmentStatusHistory.findMany({
		where: {
			shipmentId,
			note: {
				startsWith: "[ISSUE_REPORTED:",
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return statusHistories.map((h) => {
		const match = h.note?.match(/\[ISSUE_REPORTED:([A-Z_]+)\]\s*(.*)/);
		const issueType = match ? match[1] : "UNKNOWN";
		const description = match ? match[2] : h.note;

		return {
			id: h.id,
			shipmentId: h.shipmentId,
			trackingNumber: shipment.trackingNumber,
			issueType,
			description,
			reportedAt: h.createdAt,
		};
	});
};

const getMyReportedIssues = async (userId: string) => {
	const customer = await getCustomerByUserId(userId);

	const issues = await prisma.shipmentStatusHistory.findMany({
		where: {
			note: {
				startsWith: "[ISSUE_REPORTED:",
			},
			shipment: {
				customerId: customer.id,
			},
		},
		include: {
			shipment: {
				select: {
					id: true,
					trackingNumber: true,
					status: true,
					deliveryType: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return issues.map((h) => {
		const match = h.note?.match(/\[ISSUE_REPORTED:([A-Z_]+)\]\s*(.*)/);
		const issueType = match ? match[1] : "UNKNOWN";
		const description = match ? match[2] : h.note;

		return {
			id: h.id,
			shipmentId: h.shipmentId,
			trackingNumber: h.shipment.trackingNumber,
			shipmentStatus: h.shipment.status,
			deliveryType: h.shipment.deliveryType,
			issueType,
			description,
			reportedAt: h.createdAt,
		};
	});
};

export const UserService = {
	getProfile,
	updateProfile,
	getAllUsers,
	getUserById,
	updateUserStatus,
	addAddress,
	getMyAddresses,
	getAddressById,
	updateAddress,
	deleteAddress,
	createShipmentRequest,
	getMyShipments,
	getShipmentById,
	trackShipment,
	schedulePickup,
	cancelShipment,
	getPricingRules,
	calculatePricing,
	getDeliveryHistory,
	getMyInvoices,
	getInvoiceById,
	reportDeliveryIssue,
	getShipmentIssues,
	getMyReportedIssues,
};

