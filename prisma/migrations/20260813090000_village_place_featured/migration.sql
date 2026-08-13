-- Add an opt-in featured marker for VillagePlace. Existing places remain unfeatured.
ALTER TABLE "VillagePlace" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "VillagePlace_isFeatured_idx" ON "VillagePlace"("isFeatured");
