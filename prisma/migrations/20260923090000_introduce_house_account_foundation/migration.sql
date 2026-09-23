-- Additive foundation for the House Account migration. Existing authentication,
-- memberships, binding requests, and person links remain unchanged.
CREATE TYPE "AccountKind" AS ENUM ('HEADMAN', 'RESIDENT_HOUSE', 'LEGACY_RESIDENT');

CREATE TYPE "HouseAccountOpeningRequestStatus" AS ENUM (
  'PENDING_EMAIL_VERIFICATION',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "AccountEmailStatus" AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED_PENDING_REVIEW',
  'ACTIVE',
  'REVOKED'
);

CREATE TYPE "AccountEmailSource" AS ENUM (
  'OPENING_REQUEST',
  'HOUSE_ACCOUNT',
  'HEADMAN',
  'RECOVERY'
);

ALTER TABLE "User" ADD COLUMN "accountKind" "AccountKind";

-- Classify only identities supported by existing membership evidence. A User
-- with an active Headman membership takes precedence; other Resident members
-- remain personal legacy accounts and are not converted into House Accounts.
UPDATE "User" AS account_user
SET "accountKind" = 'HEADMAN'
WHERE EXISTS (
  SELECT 1
  FROM "VillageMembership" AS membership
  WHERE membership."userId" = account_user."id"
    AND membership."role" = 'HEADMAN'
    AND membership."status" = 'ACTIVE'
);

UPDATE "User" AS account_user
SET "accountKind" = 'LEGACY_RESIDENT'
WHERE account_user."accountKind" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "VillageMembership" AS membership
    WHERE membership."userId" = account_user."id"
      AND membership."role" = 'RESIDENT'
  );

CREATE TABLE "ResidentHouseAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "villageId" TEXT NOT NULL,
  "houseId" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResidentHouseAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseAccountOpeningRequest" (
  "id" TEXT NOT NULL,
  "villageId" TEXT NOT NULL,
  "houseId" TEXT NOT NULL,
  "applicantFirstName" TEXT NOT NULL,
  "applicantLastName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "emailSnapshot" TEXT NOT NULL,
  "normalizedEmailSnapshot" TEXT NOT NULL,
  "status" "HouseAccountOpeningRequestStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
  "requestedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "rejectionReason" TEXT,
  "activatedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HouseAccountOpeningRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountEmail" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "status" "AccountEmailStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "source" "AccountEmailSource" NOT NULL,
  "userId" TEXT,
  "residentHouseAccountId" TEXT,
  "openingRequestId" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResidentHouseAccount_userId_key"
ON "ResidentHouseAccount"("userId");

CREATE UNIQUE INDEX "ResidentHouseAccount_houseId_key"
ON "ResidentHouseAccount"("houseId");

CREATE INDEX "ResidentHouseAccount_villageId_idx"
ON "ResidentHouseAccount"("villageId");

CREATE UNIQUE INDEX "HouseAccountOpeningRequest_activatedUserId_key"
ON "HouseAccountOpeningRequest"("activatedUserId");

CREATE INDEX "HouseAccountOpeningRequest_village_status_created_idx"
ON "HouseAccountOpeningRequest"("villageId", "status", "createdAt");

CREATE INDEX "HouseAccountOpeningRequest_houseId_idx"
ON "HouseAccountOpeningRequest"("houseId");

CREATE INDEX "HouseAccountOpeningRequest_reviewer_idx"
ON "HouseAccountOpeningRequest"("reviewedByUserId");

-- Historical terminal requests may coexist. Only requests still capable of
-- activation occupy the House's single in-flight request slot.
CREATE UNIQUE INDEX "HouseAccountOpeningRequest_one_active_per_house"
ON "HouseAccountOpeningRequest"("houseId")
WHERE "status" IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW');

CREATE UNIQUE INDEX "AccountEmail_normalizedEmail_key"
ON "AccountEmail"("normalizedEmail");

CREATE UNIQUE INDEX "AccountEmail_openingRequestId_key"
ON "AccountEmail"("openingRequestId");

CREATE INDEX "AccountEmail_status_idx"
ON "AccountEmail"("status");

CREATE INDEX "AccountEmail_userId_idx"
ON "AccountEmail"("userId");

CREATE INDEX "AccountEmail_residentHouseAccountId_idx"
ON "AccountEmail"("residentHouseAccountId");

CREATE INDEX "AccountEmail_createdByUserId_idx"
ON "AccountEmail"("createdByUserId");

ALTER TABLE "ResidentHouseAccount"
ADD CONSTRAINT "ResidentHouseAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResidentHouseAccount"
ADD CONSTRAINT "ResidentHouseAccount_villageId_fkey"
FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResidentHouseAccount"
ADD CONSTRAINT "ResidentHouseAccount_houseId_fkey"
FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HouseAccountOpeningRequest"
ADD CONSTRAINT "HouseAccountOpeningRequest_villageId_fkey"
FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HouseAccountOpeningRequest"
ADD CONSTRAINT "HouseAccountOpeningRequest_houseId_fkey"
FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HouseAccountOpeningRequest"
ADD CONSTRAINT "HouseAccountOpeningRequest_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HouseAccountOpeningRequest"
ADD CONSTRAINT "HouseAccountOpeningRequest_activatedUserId_fkey"
FOREIGN KEY ("activatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountEmail"
ADD CONSTRAINT "AccountEmail_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountEmail"
ADD CONSTRAINT "AccountEmail_residentHouseAccountId_fkey"
FOREIGN KEY ("residentHouseAccountId") REFERENCES "ResidentHouseAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountEmail"
ADD CONSTRAINT "AccountEmail_openingRequestId_fkey"
FOREIGN KEY ("openingRequestId") REFERENCES "HouseAccountOpeningRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountEmail"
ADD CONSTRAINT "AccountEmail_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
