-- New Headman broadcasts are village-owned. Legacy platform-wide broadcasts
-- deliberately remain NULL because no authoritative village can be inferred.
ALTER TABLE "SystemBroadcast" ADD COLUMN "villageId" TEXT;

CREATE INDEX "SystemBroadcast_villageId_createdAt_idx" ON "SystemBroadcast"("villageId", "createdAt");

ALTER TABLE "SystemBroadcast" ADD CONSTRAINT "SystemBroadcast_villageId_fkey"
  FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;
