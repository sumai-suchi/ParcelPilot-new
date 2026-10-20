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

export const AiInternalService = {
	getShipmentByTrackingNumber,
};