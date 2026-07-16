CREATE TYPE "RegistrationOtpChallengeStatus" AS ENUM ('PENDING_SEND', 'ACTIVE', 'SEND_FAILED', 'CONSUMED');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DELETION_PENDING', 'ANONYMIZED');

ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "scheduledDeletionAt" TIMESTAMP(3),
ADD COLUMN "anonymizedAt" TIMESTAMP(3),
ADD COLUMN "deletionRecoveryHash" TEXT;

CREATE TABLE "RegistrationOtpChallenge" (
  "id" TEXT NOT NULL, "phoneNumber" TEXT NOT NULL, "otpIdentifier" TEXT NOT NULL,
  "status" "RegistrationOtpChallengeStatus" NOT NULL DEFAULT 'PENDING_SEND',
  "otpSentAt" TIMESTAMP(3), "otpExpiresAt" TIMESTAMP(3), "resendAvailableAt" TIMESTAMP(3),
  "resendCount" INTEGER NOT NULL DEFAULT 0, "sendWindowStartedAt" TIMESTAMP(3) NOT NULL,
  "sendCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RegistrationOtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegistrationOtpChallenge_phoneNumber_key" ON "RegistrationOtpChallenge"("phoneNumber");
CREATE INDEX "RegistrationOtpChallenge_status_idx" ON "RegistrationOtpChallenge"("status");

CREATE TABLE "RegistrationVerifierSession" (
  "id" TEXT NOT NULL, "registrationId" TEXT NOT NULL, "ipHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3), "lockedUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RegistrationVerifierSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegistrationVerifierSession_registrationId_key" ON "RegistrationVerifierSession"("registrationId");
CREATE INDEX "RegistrationVerifierSession_ipHash_createdAt_idx" ON "RegistrationVerifierSession"("ipHash", "createdAt");
CREATE INDEX "RegistrationVerifierSession_expiresAt_idx" ON "RegistrationVerifierSession"("expiresAt");
ALTER TABLE "RegistrationVerifierSession" ADD CONSTRAINT "RegistrationVerifierSession_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "RegistrationTemp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountDeletionChallenge" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "phoneNumber" TEXT NOT NULL,
  "otpSentAt" TIMESTAMP(3) NOT NULL, "otpExpiresAt" TIMESTAMP(3) NOT NULL,
  "resendAvailableAt" TIMESTAMP(3) NOT NULL, "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AccountDeletionChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountDeletionChallenge_userId_key" ON "AccountDeletionChallenge"("userId");
CREATE INDEX "AccountDeletionChallenge_otpExpiresAt_idx" ON "AccountDeletionChallenge"("otpExpiresAt");
