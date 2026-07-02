-- CreateEnum
CREATE TYPE "RegistrationMode" AS ENUM ('RESIDENT', 'HEADMAN');

-- CreateEnum
CREATE TYPE "RegistrationTempStatus" AS ENUM ('WAITING_OTP', 'VERIFIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RegistrationTemp" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "registrationMode" "RegistrationMode" NOT NULL DEFAULT 'RESIDENT',
    "name" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "subdistrict" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "callbackUrl" TEXT,
    "status" "RegistrationTempStatus" NOT NULL DEFAULT 'WAITING_OTP',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationTemp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationTemp_phoneNumber_idx" ON "RegistrationTemp"("phoneNumber");

-- CreateIndex
CREATE INDEX "RegistrationTemp_status_idx" ON "RegistrationTemp"("status");

-- CreateIndex
CREATE INDEX "RegistrationTemp_expiresAt_idx" ON "RegistrationTemp"("expiresAt");
