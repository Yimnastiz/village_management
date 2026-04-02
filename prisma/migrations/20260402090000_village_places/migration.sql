-- Create enums for village places
CREATE TYPE "VillagePlaceCategory" AS ENUM ('TEMPLE', 'SHOP', 'SCHOOL', 'CLINIC', 'GOVERNMENT', 'OTHER');
CREATE TYPE "VillagePlaceSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Create village places table
CREATE TABLE "VillagePlace" (
  "id" TEXT NOT NULL,
  "villageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "VillagePlaceCategory" NOT NULL DEFAULT 'OTHER',
  "description" TEXT,
  "address" TEXT,
  "openingHours" TEXT,
  "contactPhone" TEXT,
  "mapUrl" TEXT,
  "imageUrls" JSONB,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VillagePlace_pkey" PRIMARY KEY ("id")
);

-- Create village place submissions table
CREATE TABLE "VillagePlaceSubmission" (
  "id" TEXT NOT NULL,
  "villageId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "VillagePlaceSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VillagePlaceSubmission_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "VillagePlace"
  ADD CONSTRAINT "VillagePlace_villageId_fkey"
  FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VillagePlace"
  ADD CONSTRAINT "VillagePlace_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VillagePlaceSubmission"
  ADD CONSTRAINT "VillagePlaceSubmission_villageId_fkey"
  FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VillagePlaceSubmission"
  ADD CONSTRAINT "VillagePlaceSubmission_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "VillagePlace_villageId_idx" ON "VillagePlace"("villageId");
CREATE INDEX "VillagePlace_category_idx" ON "VillagePlace"("category");
CREATE INDEX "VillagePlace_isPublic_idx" ON "VillagePlace"("isPublic");

CREATE INDEX "VillagePlaceSubmission_villageId_idx" ON "VillagePlaceSubmission"("villageId");
CREATE INDEX "VillagePlaceSubmission_requesterId_idx" ON "VillagePlaceSubmission"("requesterId");
CREATE INDEX "VillagePlaceSubmission_status_idx" ON "VillagePlaceSubmission"("status");
