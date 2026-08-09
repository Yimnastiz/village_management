-- Change requests keep approved events immutable until a headman reviews them.
CREATE TYPE "public"."VillageEventSubmissionType" AS ENUM ('CREATE', 'EDIT', 'DELETE');

ALTER TABLE "public"."VillageEventSubmission"
  ADD COLUMN "type" "public"."VillageEventSubmissionType" NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "eventId" TEXT;

CREATE INDEX "VillageEventSubmission_eventId_idx" ON "public"."VillageEventSubmission"("eventId");
