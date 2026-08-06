ALTER TABLE "VillageEvent" ADD COLUMN "createdById" TEXT;

CREATE INDEX "VillageEvent_createdById_idx" ON "VillageEvent"("createdById");

ALTER TABLE "VillageEvent"
ADD CONSTRAINT "VillageEvent_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
