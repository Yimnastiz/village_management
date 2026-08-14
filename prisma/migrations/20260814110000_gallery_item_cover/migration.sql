-- Keep legacy GalleryAlbum.coverUrl intact while promoting a GalleryItem to cover.
ALTER TABLE "GalleryItem" ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "GalleryItem_albumId_sortOrder_idx" ON "GalleryItem"("albumId", "sortOrder");

-- The old URL is retained for backwards compatibility.  Prefer an existing item
-- and otherwise create one so no cover image is lost during the transition.
WITH matched AS (
  SELECT DISTINCT ON (a."id") a."id" AS "albumId", i."id" AS "itemId"
  FROM "GalleryAlbum" a
  JOIN "GalleryItem" i ON i."albumId" = a."id" AND i."fileUrl" = a."coverUrl"
  WHERE a."coverUrl" IS NOT NULL AND a."coverUrl" <> ''
  ORDER BY a."id", i."sortOrder" ASC, i."createdAt" ASC
)
UPDATE "GalleryItem" i SET "isCover" = true FROM matched m WHERE i."id" = m."itemId";

INSERT INTO "GalleryItem" ("id", "albumId", "fileUrl", "sortOrder", "isCover", "createdAt")
SELECT 'legacy-cover-' || a."id", a."id", a."coverUrl", -1, true, NOW()
FROM "GalleryAlbum" a
WHERE a."coverUrl" IS NOT NULL AND a."coverUrl" <> ''
  AND NOT EXISTS (SELECT 1 FROM "GalleryItem" i WHERE i."albumId" = a."id" AND i."isCover" = true);
