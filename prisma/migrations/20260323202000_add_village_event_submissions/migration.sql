-- Resident village event submission workflow

CREATE TYPE "public"."VillageEventSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "public"."VillageEventSubmission" (
  "id" TEXT NOT NULL,
  "villageId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "status" "public"."VillageEventSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VillageEventSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VillageEventSubmission_villageId_idx" ON "public"."VillageEventSubmission"("villageId");
CREATE INDEX "VillageEventSubmission_requesterId_idx" ON "public"."VillageEventSubmission"("requesterId");
CREATE INDEX "VillageEventSubmission_status_idx" ON "public"."VillageEventSubmission"("status");
CREATE INDEX "VillageEventSubmission_startsAt_idx" ON "public"."VillageEventSubmission"("startsAt");

ALTER TABLE "public"."VillageEventSubmission"
ADD CONSTRAINT "VillageEventSubmission_villageId_fkey"
FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."VillageEventSubmission"
ADD CONSTRAINT "VillageEventSubmission_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
