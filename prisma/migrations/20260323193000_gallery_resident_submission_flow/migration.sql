-- Add support for resident photo submission workflow in gallery

-- 1) New status enum for gallery item submission review
CREATE TYPE "public"."GalleryItemSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2) Album-level setting for whether residents can request photo additions
ALTER TABLE "public"."GalleryAlbum"
ADD COLUMN "allowResidentSubmissions" BOOLEAN NOT NULL DEFAULT false;

-- 3) Submission table for resident requested photos
CREATE TABLE "public"."GalleryItemSubmission" (
  "id" TEXT NOT NULL,
  "albumId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "title" TEXT,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "note" TEXT,
  "status" "public"."GalleryItemSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GalleryItemSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GalleryItemSubmission_albumId_idx" ON "public"."GalleryItemSubmission"("albumId");
CREATE INDEX "GalleryItemSubmission_requesterId_idx" ON "public"."GalleryItemSubmission"("requesterId");
CREATE INDEX "GalleryItemSubmission_status_idx" ON "public"."GalleryItemSubmission"("status");

ALTER TABLE "public"."GalleryItemSubmission"
ADD CONSTRAINT "GalleryItemSubmission_albumId_fkey"
FOREIGN KEY ("albumId") REFERENCES "public"."GalleryAlbum"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."GalleryItemSubmission"
ADD CONSTRAINT "GalleryItemSubmission_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
