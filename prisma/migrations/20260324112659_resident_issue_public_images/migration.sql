-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "imageUrls" JSONB,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Issue_isPublic_idx" ON "Issue"("isPublic");
