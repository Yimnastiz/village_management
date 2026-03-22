-- CreateEnum
CREATE TYPE "NewsSubmissionType" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "NewsSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "News" ADD COLUMN "imageUrls" JSONB;

-- CreateTable
CREATE TABLE "NewsSubmission" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "NewsSubmissionType" NOT NULL,
    "status" "NewsSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "targetNewsId" TEXT,
    "payload" JSONB NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsSubmission_villageId_idx" ON "NewsSubmission"("villageId");

-- CreateIndex
CREATE INDEX "NewsSubmission_requesterId_idx" ON "NewsSubmission"("requesterId");

-- CreateIndex
CREATE INDEX "NewsSubmission_status_idx" ON "NewsSubmission"("status");

-- CreateIndex
CREATE INDEX "NewsSubmission_type_idx" ON "NewsSubmission"("type");

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSubmission" ADD CONSTRAINT "NewsSubmission_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSubmission" ADD CONSTRAINT "NewsSubmission_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSubmission" ADD CONSTRAINT "NewsSubmission_targetNewsId_fkey" FOREIGN KEY ("targetNewsId") REFERENCES "News"("id") ON DELETE SET NULL ON UPDATE CASCADE;
