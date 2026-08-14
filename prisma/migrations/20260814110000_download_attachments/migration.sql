-- Keep legacy columns in DownloadFile so existing records and links remain intact.
ALTER TABLE "DownloadFile" ADD COLUMN "categoryLabel" TEXT;

CREATE TABLE "DownloadAttachment" (
    "id" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DownloadAttachment_downloadId_sortOrder_idx" ON "DownloadAttachment"("downloadId", "sortOrder");
CREATE INDEX "DownloadFile_category_idx" ON "DownloadFile"("category");

ALTER TABLE "DownloadAttachment"
ADD CONSTRAINT "DownloadAttachment_downloadId_fkey"
FOREIGN KEY ("downloadId") REFERENCES "DownloadFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill every legacy file into an attachment.  The legacy columns are intentionally retained.
INSERT INTO "DownloadAttachment" ("id", "downloadId", "fileName", "fileKey", "fileUrl", "fileSize", "mimeType", "sortOrder", "createdAt")
SELECT
  'legacy_' || "id",
  "id",
  COALESCE(NULLIF("fileKey", ''), "title"),
  "fileKey",
  "fileUrl",
  COALESCE("fileSize", 0),
  "mimeType",
  0,
  "createdAt"
FROM "DownloadFile"
WHERE "fileUrl" IS NOT NULL AND "fileUrl" <> '';
