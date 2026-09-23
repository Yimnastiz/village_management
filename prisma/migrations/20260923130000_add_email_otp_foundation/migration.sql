-- Additive Email OTP foundation. Existing phone OTP models and routes remain
-- unchanged and continue to be the active authentication mechanism.
CREATE TYPE "EmailOtpPurpose" AS ENUM (
  'HOUSE_OPENING',
  'HOUSE_LOGIN',
  'ADD_HOUSE_EMAIL',
  'HEADMAN_LOGIN',
  'ACCOUNT_RECOVERY'
);

CREATE TYPE "EmailOtpChallengeStatus" AS ENUM (
  'PENDING_DELIVERY',
  'ACTIVE',
  'VERIFIED',
  'CONSUMED',
  'LOCKED',
  'EXPIRED',
  'CANCELLED',
  'DELIVERY_FAILED'
);

CREATE TABLE "EmailOtpChallenge" (
  "id" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "purpose" "EmailOtpPurpose" NOT NULL,
  "accountEmailId" TEXT,
  "userId" TEXT,
  "codeHash" TEXT NOT NULL,
  "codeSalt" TEXT NOT NULL,
  "status" "EmailOtpChallengeStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "maxResends" INTEGER NOT NULL,
  "lastSentAt" TIMESTAMP(3),
  "resendAvailableAt" TIMESTAMP(3),
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailOtpChallenge_email_purpose_created_idx"
ON "EmailOtpChallenge"("normalizedEmail", "purpose", "createdAt");

CREATE INDEX "EmailOtpChallenge_status_expires_idx"
ON "EmailOtpChallenge"("status", "expiresAt");

CREATE INDEX "EmailOtpChallenge_accountEmailId_idx"
ON "EmailOtpChallenge"("accountEmailId");

CREATE INDEX "EmailOtpChallenge_userId_idx"
ON "EmailOtpChallenge"("userId");

CREATE INDEX "EmailOtpChallenge_ipHash_created_idx"
ON "EmailOtpChallenge"("ipHash", "createdAt");

-- The service cancels the preceding challenge before issuance. This partial
-- index is the final concurrency guard against two simultaneously usable OTPs.
CREATE UNIQUE INDEX "EmailOtpChallenge_one_live_per_email_purpose"
ON "EmailOtpChallenge"("normalizedEmail", "purpose")
WHERE "status" IN ('PENDING_DELIVERY', 'ACTIVE', 'VERIFIED');

ALTER TABLE "EmailOtpChallenge"
ADD CONSTRAINT "EmailOtpChallenge_accountEmailId_fkey"
FOREIGN KEY ("accountEmailId") REFERENCES "AccountEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailOtpChallenge"
ADD CONSTRAINT "EmailOtpChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
