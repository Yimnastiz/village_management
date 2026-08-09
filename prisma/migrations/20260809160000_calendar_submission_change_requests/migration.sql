-- Change requests keep approved events immutable until a headman reviews them.
CREATE TYPE "VillageEventSubmissionType" AS ENUM ('CREATE', 'EDIT', 'DELETE');

ALTER TABLE "VillageEventSubmission"
  ADD COLUMN "type" "VillageEventSubmissionType" NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "eventId" TEXT;

CREATE INDEX "VillageEventSubmission_eventId_idx" ON "VillageEventSubmission"("eventId");
