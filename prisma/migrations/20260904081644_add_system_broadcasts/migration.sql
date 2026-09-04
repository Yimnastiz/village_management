-- CreateEnum
CREATE TYPE "SystemBroadcastStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "systemBroadcastId" TEXT;

-- CreateTable
CREATE TABLE "SystemBroadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SystemBroadcastStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "audienceCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemBroadcast_createdAt_idx" ON "SystemBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX "SystemBroadcast_status_createdAt_idx" ON "SystemBroadcast"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemBroadcast_expiresAt_idx" ON "SystemBroadcast"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_systemBroadcastId_idx" ON "Notification"("systemBroadcastId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_systemBroadcastId_fkey" FOREIGN KEY ("systemBroadcastId") REFERENCES "SystemBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemBroadcast" ADD CONSTRAINT "SystemBroadcast_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
