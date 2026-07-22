ALTER TYPE "AuditAction" ADD VALUE 'VILLAGE_CREATED_FROM_CATALOG';
ALTER TYPE "AuditAction" ADD VALUE 'VILLAGE_CREATED_MANUAL';
ALTER TYPE "AuditAction" ADD VALUE 'VILLAGE_CATALOG_IMPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'VILLAGE_CATALOG_UPDATED';

ALTER TABLE "Village"
ADD COLUMN "moo" TEXT,
ADD COLUMN "sourceNote" TEXT,
ADD COLUMN "catalogVillageId" TEXT;

CREATE TABLE "ThailandVillageMaster" (
  "id" TEXT NOT NULL,
  "officialCode" TEXT,
  "villageName" TEXT NOT NULL,
  "moo" TEXT,
  "subdistrict" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "sourceName" TEXT,
  "sourceUrl" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThailandVillageMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Village_catalogVillageId_key" ON "Village"("catalogVillageId");
CREATE UNIQUE INDEX "ThailandVillageMaster_officialCode_key" ON "ThailandVillageMaster"("officialCode");
CREATE UNIQUE INDEX "ThailandVillageMaster_province_district_subdistrict_villageName_moo_key" ON "ThailandVillageMaster"("province", "district", "subdistrict", "villageName", "moo");
CREATE INDEX "ThailandVillageMaster_province_district_subdistrict_idx" ON "ThailandVillageMaster"("province", "district", "subdistrict");
CREATE INDEX "ThailandVillageMaster_villageName_idx" ON "ThailandVillageMaster"("villageName");
CREATE INDEX "ThailandVillageMaster_province_district_subdistrict_villageName_idx" ON "ThailandVillageMaster"("province", "district", "subdistrict", "villageName");

ALTER TABLE "Village" ADD CONSTRAINT "Village_catalogVillageId_fkey" FOREIGN KEY ("catalogVillageId") REFERENCES "ThailandVillageMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
