CREATE TYPE "LoginOtpChallengeStatus" AS ENUM ('PENDING_SEND', 'ACTIVE', 'VERIFYING', 'SEND_FAILED', 'LOCKED', 'CONSUMED');

CREATE TABLE "LoginOtpChallenge" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "otpIdentifier" TEXT NOT NULL,
    "challengeToken" TEXT NOT NULL,
    "status" "LoginOtpChallengeStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "otpSentAt" TIMESTAMP(3),
    "otpExpiresAt" TIMESTAMP(3),
    "resendAvailableAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sendWindowStartedAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginOtpChallenge_phoneNumber_key" ON "LoginOtpChallenge"("phoneNumber");
CREATE UNIQUE INDEX "LoginOtpChallenge_challengeToken_key" ON "LoginOtpChallenge"("challengeToken");
CREATE INDEX "LoginOtpChallenge_status_idx" ON "LoginOtpChallenge"("status");
CREATE INDEX "LoginOtpChallenge_lockedUntil_idx" ON "LoginOtpChallenge"("lockedUntil");
