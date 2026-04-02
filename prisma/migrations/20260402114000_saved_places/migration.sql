-- Add support for saving village places in resident saved items.
ALTER TABLE "SavedItem"
ADD COLUMN "placeId" TEXT;

ALTER TABLE "SavedItem"
ADD CONSTRAINT "SavedItem_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "VillagePlace"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SavedItem_userId_placeId_key"
ON "SavedItem"("userId", "placeId");
