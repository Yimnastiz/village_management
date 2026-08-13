-- Keep the resolved place id so residents can open the result of an approved request.
ALTER TABLE "VillagePlaceSubmission" ADD COLUMN "approvedPlaceId" TEXT;

CREATE INDEX "VillagePlaceSubmission_approvedPlaceId_idx" ON "VillagePlaceSubmission"("approvedPlaceId");
