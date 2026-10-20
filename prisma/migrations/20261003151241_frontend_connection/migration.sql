-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'COURIER', 'HUB_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "courier_availability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('PENDING_APPROVAL', 'CREATED', 'COURIER_ASSIGNED', 'PICKUP_ASSIGNED', 'PICKED_UP', 'AT_ORIGIN_HUB', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RESCHEDULED', 'RETURN_INITIATED', 'RETURN_IN_TRANSIT', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('PENDING', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'CREDENTIALS');

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" VARCHAR(50),
    "address_line" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "area" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couriers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hub_id" UUID NOT NULL,
    "vehicle_type" VARCHAR(50) NOT NULL,
    "vehicle_number" VARCHAR(50) NOT NULL,
    "availability_status" "courier_availability" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_assignments" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "courier_id" UUID NOT NULL,
    "assigned_by" UUID,
    "status" "assignment_status" NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "courier_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" "attempt_status" NOT NULL,
    "failure_reason" VARCHAR(255),
    "notes" TEXT,
    "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hubs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "zone_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_transfers" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "from_hub_id" UUID NOT NULL,
    "to_hub_id" UUID NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'PENDING',
    "dispatched_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hub_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shipment_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'BDT',
    "provider" VARCHAR(50) NOT NULL,
    "transaction_id" VARCHAR(255),
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "delivery_type" VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    "min_weight" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "max_weight" DECIMAL(8,2) NOT NULL,
    "base_charge" DECIMAL(10,2) NOT NULL,
    "per_kg_charge" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_deliveries" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "delivery_attempt_id" UUID NOT NULL,
    "recipient_name" VARCHAR(255) NOT NULL,
    "recipient_phone" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(1000),
    "signature_url" VARCHAR(1000),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "tracking_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "pickup_address_id" UUID NOT NULL,
    "delivery_address_id" UUID NOT NULL,
    "origin_hub_id" UUID,
    "destination_hub_id" UUID,
    "parcel_type" VARCHAR(50) NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "description" TEXT,
    "delivery_type" VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    "status" "shipment_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "delivery_charge" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "payment_status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "scheduled_pickup_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_history" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "location" VARCHAR(255),
    "note" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255),
    "google_id" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIALS',
    "email_verified" BOOLEAN DEFAULT false,
    "phone" VARCHAR(50),
    "role" "user_role" NOT NULL DEFAULT 'CUSTOMER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "couriers_user_id_key" ON "couriers"("user_id");

-- CreateIndex
CREATE INDEX "idx_courier_assignments_shipment" ON "courier_assignments"("shipment_id");

-- CreateIndex
CREATE INDEX "idx_courier_assignments_courier" ON "courier_assignments"("courier_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "idx_delivery_attempts_shipment" ON "delivery_attempts"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "hubs_code_key" ON "hubs"("code");

-- CreateIndex
CREATE INDEX "idx_hub_transfers_shipment" ON "hub_transfers"("shipment_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_shipment_id_key" ON "payments"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_shipment_id_key" ON "proof_of_deliveries"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_delivery_attempt_id_key" ON "proof_of_deliveries"("delivery_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "idx_shipments_tracking_number" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "idx_shipments_status" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "idx_shipments_customer" ON "shipments"("customer_id");

-- CreateIndex
CREATE INDEX "idx_shipment_history_shipment" ON "shipment_status_history"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "fk_addresses_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couriers" ADD CONSTRAINT "fk_couriers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couriers" ADD CONSTRAINT "fk_couriers_hub" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_assignments" ADD CONSTRAINT "fk_assignments_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_assignments" ADD CONSTRAINT "fk_assignments_courier" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_assignments" ADD CONSTRAINT "fk_assignments_assigned_by" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "fk_customers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "fk_delivery_attempts_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "fk_delivery_attempts_courier" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hubs" ADD CONSTRAINT "fk_hubs_zone" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "fk_hub_transfers_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "fk_hub_transfers_from_hub" FOREIGN KEY ("from_hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "fk_hub_transfers_to_hub" FOREIGN KEY ("to_hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "fk_hub_transfers_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "fk_pricing_rules_zone" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "fk_pod_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "fk_pod_attempt" FOREIGN KEY ("delivery_attempt_id") REFERENCES "delivery_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_pickup_address" FOREIGN KEY ("pickup_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_delivery_address" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_origin_hub" FOREIGN KEY ("origin_hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_dest_hub" FOREIGN KEY ("destination_hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "fk_status_history_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "fk_status_history_user" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
