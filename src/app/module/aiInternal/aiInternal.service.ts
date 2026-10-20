import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const getShipmentByTrackingNumber = async (trackingNumber: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: {
			trackingNumber,
		},
		select: {
			id: true,
			trackingNumber: true,
			status: true,
			parcelType: true,
			weight: true,
			deliveryType: true,
			scheduledPickupAt: true,
			createdAt: true,
			updatedAt: true,
			originHub: {
				select: {
					id: true,
					name: true,
					code: true,
					address: true,
				},
			},
			destinationHub: {
				select: {
					id: true,
					name: true,
					code: true,
					address: true,
				},
			},
			pickupAddress: {
				select: {
					city: true,
					area: true,
					addressLine: true,
				},
			},
			deliveryAddress: {
				select: {
					city: true,
					area: true,
					addressLine: true,
				},
			},
			statusHistory: {
				orderBy: {
					createdAt: "desc",
				},
				take: 3,
				select: {
					status: true,
					   note: true,    
					createdAt: true,
				},
			},
		},
	});

	console.log(shipment)

	if (!shipment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			`Shipment with tracking number '${trackingNumber}' was not found.`,
		);
	}

	return shipment;
};



const getOperationsSummary = async () => {
	const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
	const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

	// ১. যে শিপমেন্টগুলোতে কুরিয়ার অ্যাসাইন হয়নি (২ ঘণ্টার বেশি পেন্ডিং)
	const unassignedShipments = await prisma.shipment.findMany({
		where: {
			status: { in: ["CREATED", "AT_ORIGIN_HUB", "AT_DESTINATION_HUB"] },
			createdAt: { lte: twoHoursAgo },
			courierAssignments: {
				none: {
					status: { in: ["PENDING", "ACCEPTED"] },
				},
			},
		},
		select: {
			id: true,
			trackingNumber: true,
			status: true,
			createdAt: true,
			originHub: { select: { id: true, name: true, code: true } },
			destinationHub: { select: { id: true, name: true, code: true } },
		},
	});

	// ২. ফেইল্ড ডেলিভারি (যেগুলোর তাৎক্ষণিক দৃষ্টি প্রয়োজন)
	const failedDeliveries = await prisma.shipment.findMany({
		where: {
			status: "DELIVERY_FAILED",
			updatedAt: { gte: twentyFourHoursAgo },
		},
		select: {
			trackingNumber: true,
			destinationHub: { select: { name: true } },
			updatedAt: true,
			deliveryAttempts: {
				orderBy: { attemptedAt: "desc" },
				take: 1,
				select: { failureReason: true, notes: true },
			},
		},
	});

	// ৩. ডিলেড বা আটকে থাকা শিপমেন্ট (২৪ ঘণ্টার বেশি ট্রানজিটে আছে)
	const delayedShipments = await prisma.shipment.findMany({
		where: {
			status: { in: ["IN_TRANSIT", "OUT_FOR_DELIVERY"] },
			updatedAt: { lte: twentyFourHoursAgo },
		},
		select: {
			trackingNumber: true,
			status: true,
			updatedAt: true,
			originHub: { select: { name: true } },
			destinationHub: { select: { name: true } },
		},
	});

	// ৪. কুরিয়ারদের বর্তমান প্রাপ্যতা (Hub অনুযায়ী কুরিয়ার সংখ্যা)
	const courierStats = await prisma.courier.groupBy({
		by: ["hubId", "availabilityStatus"],
		_count: { id: true },
	});

	// ৫. সকল সক্রিয় হাবের তালিকা
	const hubs = await prisma.hub.findMany({
		where: { isActive: true },
		select: { id: true, name: true, code: true },
	});

	return {
		timestamp: new Date().toISOString(),
		summary: {
			totalUnassignedOver2Hours: unassignedShipments.length,
			totalFailedDeliveries24h: failedDeliveries.length,
			totalDelayedInTransit: delayedShipments.length,
		},
		unassignedShipments,
		failedDeliveries,
		delayedShipments,
		courierAvailability: courierStats,
		activeHubs: hubs,
	};
};

// Export-এ getOperationsSummary যুক্ত করে দিন:
export const AiInternalService = {
	getShipmentByTrackingNumber,
	getOperationsSummary,
};