-- Preserve submission-session context and the approved item's audit provenance.
ALTER TABLE "GalleryItemSubmission"
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "batchOrder" INTEGER,
  ADD COLUMN "fileKey" TEXT;

ALTER TABLE "GalleryItem"
  ADD COLUMN "sourceSubmissionId" TEXT;

CREATE UNIQUE INDEX "GalleryItem_sourceSubmissionId_key" ON "GalleryItem"("sourceSubmissionId");
CREATE INDEX "GalleryItemSubmission_batchId_idx" ON "GalleryItemSubmission"("batchId");
CREATE INDEX "GalleryItemSubmission_albumId_batchId_idx" ON "GalleryItemSubmission"("albumId", "batchId");

ALTER TABLE "GalleryItem"
  ADD CONSTRAINT "GalleryItem_sourceSubmissionId_fkey"
  FOREIGN KEY ("sourceSubmissionId") REFERENCES "GalleryItemSubmission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
