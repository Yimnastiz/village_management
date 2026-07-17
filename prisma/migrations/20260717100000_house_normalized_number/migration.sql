-- Backfill the canonical house number before enforcing uniqueness.
ALTER TABLE "House" ADD COLUMN "normalizedHouseNumber" TEXT;

UPDATE "House"
SET "normalizedHouseNumber" = upper(
  regexp_replace(
    regexp_replace(translate(trim("houseNumber"), '๐๑๒๓๔๕๖๗๘๙', '0123456789'), '\s+', '', 'g'),
    '/+', '/', 'g'
  )
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "House"
    GROUP BY "villageId", "normalizedHouseNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate houses found after normalization; merge records manually before applying this migration';
  END IF;
END $$;

ALTER TABLE "House" ALTER COLUMN "normalizedHouseNumber" SET NOT NULL;
DROP INDEX IF EXISTS "House_villageId_houseNumber_key";
CREATE UNIQUE INDEX "House_villageId_normalizedHouseNumber_key" ON "House"("villageId", "normalizedHouseNumber");
