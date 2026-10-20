import process from "node:process";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
	AuthProvider,
	CourierAvailability,
	UserRole,
	UserStatus,
} from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedUsers = async () => {
	try {
		console.log("🌱 Seeding initial users...");

		const saltRounds = Number(config.bcrypt_salt_rounds) || 10;

		// 1. Ensure default Zone and Hub exist for Courier profile assignment
		let defaultZone = await prisma.zone.findFirst({
			where: { code: "ZONE-DHK-01" },
		});

		if (!defaultZone) {
			defaultZone = await prisma.zone.create({
				data: {
					code: "ZONE-DHK-01",
					name: "Dhaka Central Zone",
					isActive: true,
				},
			});
			console.log(
				`📍 Created default zone: ${defaultZone.name} (${defaultZone.code})`,
			);
		}

		let defaultHub = await prisma.hub.findFirst({
			where: { code: "HUB-DHK-CENTRAL" },
		});

		if (!defaultHub) {
			defaultHub = await prisma.hub.create({
				data: {
					code: "HUB-DHK-CENTRAL",
					name: "Central Distribution Hub",
					zoneId: defaultZone.id,
					address: "Tejgaon Industrial Area, Dhaka",
					phone: "+8801700000099",
					isActive: true,
				},
			});
			console.log(
				`🏢 Created default hub: ${defaultHub.name} (${defaultHub.code})`,
			);
		}

		// 2. Define users for requested roles: ADMIN, OPERATIONS_MANAGER, HUB_MANAGER, COURIER
		const usersToSeed = [
			{
				name: config.admin_name || "System Admin",
				email: (config.admin_email || "superadmin@gmail.com")
					.toLowerCase()
					.trim(),
				password: config.admin_password || "Super@admin12345",
				phone: config.admin_phone || "+8801700000001",
				role: UserRole.ADMIN,
			},
			{
				name: config.operations_manager_name || "Operations Manager",
				email: (config.operations_manager_email || "operations@parcelpilot.com")
					.toLowerCase()
					.trim(),
				password: config.operations_manager_password || "Ops@123456",
				phone: config.operations_manager_phone || "+8801700000002",
				role: UserRole.OPERATIONS_MANAGER,
			},
			{
				name: config.hub_manager_name || "Hub Manager",
				email: (config.hub_manager_email || "hubmanager@parcelpilot.com")
					.toLowerCase()
					.trim(),
				password: config.hub_manager_password || "Hub@123456",
				phone: config.hub_manager_phone || "+8801700000003",
				role: UserRole.HUB_MANAGER,
			},
			{
				name: config.courier_name || "Courier Rider",
				email: (config.courier_email || "courier@parcelpilot.com")
					.toLowerCase()
					.trim(),
				password: config.courier_password || "Courier@123456",
				phone: config.courier_phone || "+8801700000004",
				role: UserRole.COURIER,
			},
			{
				name: "Customer",
				email: "customer@parcelpilot.com".toLowerCase().trim(),
				password: "Customer@123456",
				phone: "+8801700000005",
				role: UserRole.CUSTOMER,
			},
		];

		for (const userData of usersToSeed) {
			const existingUser = await prisma.user.findUnique({
				where: { email: userData.email },
				include: { courier: true, customer: true },
			});

			if (existingUser) {
				console.log(`ℹ️ ${userData.role} already exists: ${userData.email}`);

				// If user is COURIER but has no Courier profile, create it
				if (userData.role === UserRole.COURIER && !existingUser.courier) {
					await prisma.courier.create({
						data: {
							userId: existingUser.id,
							hubId: defaultHub.id,
							vehicleType: "Motorcycle",
							vehicleNumber: "DHAKA-METRO-HA-1234",
							availabilityStatus: CourierAvailability.AVAILABLE,
						},
					});
					console.log(
						`📦 Created missing Courier profile for: ${userData.email}`,
					);
				}

				// If user is CUSTOMER but has no Customer profile, create it
				if (userData.role === UserRole.CUSTOMER && !existingUser.customer) {
					await prisma.customer.create({
						data: {
							userId: existingUser.id,
						},
					});
					console.log(
						`📦 Created missing Customer profile for: ${userData.email}`,
					);
				}
				continue;
			}

			// Check phone collision before seeding
			const existingPhone = userData.phone
				? await prisma.user.findUnique({ where: { phone: userData.phone } })
				: null;

			const phoneToUse = existingPhone ? null : userData.phone;
			const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

			if (userData.role === UserRole.COURIER) {
				await prisma.user.create({
					data: {
						name: userData.name,
						email: userData.email,
						password: hashedPassword,
						phone: phoneToUse,
						role: userData.role,
						status: UserStatus.ACTIVE,
						emailVerified: true,
						authProvider: AuthProvider.CREDENTIALS,
						courier: {
							create: {
								hubId: defaultHub.id,
								vehicleType: "Motorcycle",
								vehicleNumber: "DHAKA-METRO-HA-1234",
								availabilityStatus: CourierAvailability.AVAILABLE,
							},
						},
					},
				});
				console.log(
					`✅ Seeded ${userData.role}: ${userData.email} (with Courier profile)`,
				);
			} else if (userData.role === UserRole.CUSTOMER) {
				await prisma.user.create({
					data: {
						name: userData.name,
						email: userData.email,
						password: hashedPassword,
						phone: phoneToUse,
						role: userData.role,
						status: UserStatus.ACTIVE,
						emailVerified: true,
						authProvider: AuthProvider.CREDENTIALS,
						customer: {
							create: {},
						},
					},
				});
				console.log(
					`✅ Seeded ${userData.role}: ${userData.email} (with Customer profile)`,
				);
			} else {
				await prisma.user.create({
					data: {
						name: userData.name,
						email: userData.email,
						password: hashedPassword,
						phone: phoneToUse,
						role: userData.role,
						status: UserStatus.ACTIVE,
						emailVerified: true,
						authProvider: AuthProvider.CREDENTIALS,
					},
				});
				console.log(`✅ Seeded ${userData.role}: ${userData.email}`);
			}
		}

		console.log("✨ Seeding completed successfully.");
	} catch (error) {
		console.error("❌ Error during user seeding:", error);
		throw error;
	}
};

export const seed = seedUsers;

// Execute directly when run as CLI script
const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1];

if (
	executedFile &&
	(executedFile === currentFile ||
		executedFile.endsWith("seed.ts") ||
		executedFile.endsWith("seed.js"))
) {
	seedUsers()
		.then(async () => {
			await prisma.$disconnect();
			process.exit(0);
		})
		.catch(async (error) => {
			console.error(error);
			await prisma.$disconnect();
			process.exit(1);
		});
}
