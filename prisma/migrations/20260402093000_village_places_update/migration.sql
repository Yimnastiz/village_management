-- Extend VillagePlace with coordinates
ALTER TABLE "VillagePlace"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

-- Add submission type for create/update place requests
CREATE TYPE "VillagePlaceSubmissionType" AS ENUM ('CREATE', 'UPDATE');

ALTER TABLE "VillagePlaceSubmission"
  ADD COLUMN "type" "VillagePlaceSubmissionType" NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "targetPlaceId" TEXT;

CREATE INDEX "VillagePlaceSubmission_type_idx" ON "VillagePlaceSubmission"("type");
CREATE INDEX "VillagePlaceSubmission_targetPlaceId_idx" ON "VillagePlaceSubmission"("targetPlaceId");
