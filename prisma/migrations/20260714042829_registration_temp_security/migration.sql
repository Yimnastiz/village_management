-- AlterEnum
ALTER TYPE "RegistrationTempStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "RegistrationTemp" ADD COLUMN     "otpFailedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "otpLockedUntil" TIMESTAMP(3),
ADD COLUMN     "otpResendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpSentAt" TIMESTAMP(3),
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3);
