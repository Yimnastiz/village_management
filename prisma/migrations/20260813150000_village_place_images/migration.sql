ALTER TYPE "VillagePlaceCategory" ADD VALUE IF NOT EXISTS 'FOOD';
ALTER TYPE "VillagePlaceCategory" ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE "VillagePlaceCategory" ADD VALUE IF NOT EXISTS 'COMMUNITY';
ALTER TYPE "VillagePlaceCategory" ADD VALUE IF NOT EXISTS 'AGRICULTURE';
ALTER TYPE "VillagePlaceCategory" ADD VALUE IF NOT EXISTS 'ACCOMMODATION';
ALTER TYPE "VillagePlaceCategory" ADD VALUE IF NOT EXISTS 'TRANSPORT';

CREATE TABLE "VillagePlaceImage" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VillagePlaceImage_pkey" PRIMARY KEY ("id")
);

INSERT INTO "VillagePlaceImage" ("id", "placeId", "url", "sortOrder", "isCover")
SELECT
  'legacy_' || md5(place."id" || ':' || image.ordinality::text),
  place."id",
  image.url,
  image.ordinality - 1,
  image.ordinality = 1
FROM "VillagePlace" AS place
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(place."imageUrls") = 'array' THEN place."imageUrls" ELSE '[]'::jsonb END
) WITH ORDINALITY AS image(url, ordinality)
WHERE length(image.url) > 0;

CREATE INDEX "VillagePlaceImage_placeId_sortOrder_idx"
  ON "VillagePlaceImage"("placeId", "sortOrder");

CREATE UNIQUE INDEX "VillagePlaceImage_one_cover_per_place_idx"
  ON "VillagePlaceImage"("placeId") WHERE "isCover" = true;

ALTER TABLE "VillagePlaceImage"
  ADD CONSTRAINT "VillagePlaceImage_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "VillagePlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
