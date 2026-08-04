-- Enrich the government village catalog without creating operational Village rows.
ALTER TABLE "ThailandVillageMaster"
  ADD COLUMN "lookupKey" TEXT,
  ADD COLUMN "normalizedName" TEXT,
  ADD COLUMN "provinceCode" TEXT,
  ADD COLUMN "normalizedProvince" TEXT,
  ADD COLUMN "districtCode" TEXT,
  ADD COLUMN "normalizedDistrict" TEXT,
  ADD COLUMN "subdistrictCode" TEXT,
  ADD COLUMN "normalizedSubdistrict" TEXT,
  ADD COLUMN "populationTotal" INTEGER,
  ADD COLUMN "malePopulation" INTEGER,
  ADD COLUMN "femalePopulation" INTEGER,
  ADD COLUMN "householdCount" INTEGER;

CREATE UNIQUE INDEX "tvm_lookup_key" ON "ThailandVillageMaster"("lookupKey");
CREATE INDEX "tvm_area_code_idx" ON "ThailandVillageMaster"("provinceCode", "districtCode", "subdistrictCode");
CREATE INDEX "tvm_norm_area_idx" ON "ThailandVillageMaster"("normalizedProvince", "normalizedDistrict", "normalizedSubdistrict");
CREATE INDEX "tvm_norm_name_idx" ON "ThailandVillageMaster"("normalizedName");
