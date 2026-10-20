-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_picture" TEXT;

-- CreateTable
CREATE TABLE "role_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "desired_role" "user_role" NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "experience" TEXT,
    "vehicle_type" VARCHAR(50),
    "vehicle_number" VARCHAR(50),
    "hub_id" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_applications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "role_applications" ADD CONSTRAINT "fk_role_applications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_applications" ADD CONSTRAINT "fk_role_applications_hub" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
