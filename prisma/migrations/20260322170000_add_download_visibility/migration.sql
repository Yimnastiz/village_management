-- AlterTable
ALTER TABLE "DownloadFile"
ADD COLUMN "visibility" "NewsVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "DownloadFile_visibility_idx" ON "DownloadFile"("visibility");
