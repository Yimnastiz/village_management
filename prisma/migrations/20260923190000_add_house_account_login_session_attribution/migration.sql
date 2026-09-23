-- Attribute shared House Account sessions to the verified login alias without
-- changing the owning User. Revoking an alias retains the session row but
-- clears its attribution through ON DELETE SET NULL.
ALTER TABLE "AuthSession"
ADD COLUMN "loginAccountEmailId" TEXT;

CREATE INDEX "AuthSession_loginAccountEmailId_idx"
ON "AuthSession"("loginAccountEmailId");

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_loginAccountEmailId_fkey"
FOREIGN KEY ("loginAccountEmailId") REFERENCES "AccountEmail"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Server-owned, short-lived browser flow state. Rows with a NULL challengeId
-- are intentional decoys used to keep the public start response independent
-- of House/email eligibility.
CREATE TABLE "HouseAccountLoginFlow" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT,
  "houseId" TEXT,
  "accountEmailId" TEXT,
  "callbackUrl" TEXT,
  "maskedEmail" TEXT NOT NULL,
  "ipHash" TEXT,
  "emailHash" TEXT,
  "houseNumberHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resendAvailableAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HouseAccountLoginFlow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HouseAccountLoginFlow_challengeId_key"
ON "HouseAccountLoginFlow"("challengeId");

CREATE INDEX "HouseAccountLoginFlow_ipHash_createdAt_idx"
ON "HouseAccountLoginFlow"("ipHash", "createdAt");

CREATE INDEX "HouseAccountLoginFlow_emailHash_createdAt_idx"
ON "HouseAccountLoginFlow"("emailHash", "createdAt");

CREATE INDEX "HouseAccountLoginFlow_expiresAt_idx"
ON "HouseAccountLoginFlow"("expiresAt");
