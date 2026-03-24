-- AlterTable
ALTER TABLE "GalleryAlbum" ADD COLUMN "albumDate" TIMESTAMP(3);

UPDATE "GalleryAlbum"
SET "albumDate" = "createdAt"
WHERE "albumDate" IS NULL;

ALTER TABLE "GalleryAlbum"
ALTER COLUMN "albumDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "GalleryAlbum_albumDate_idx" ON "GalleryAlbum"("albumDate");