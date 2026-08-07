ALTER TABLE "ThailandVillageMaster" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "tvm_slug_key" ON "ThailandVillageMaster"("slug");

-- The importer fills this for every catalog row with an official code. Existing
-- records are deliberately left unchanged here so a deployment does not alter
-- public routes until the catalog is re-imported/backfilled.
