-- AlterTable: add new optional foreign-key columns
ALTER TABLE "SavedItem" ADD COLUMN "issueId" TEXT;
ALTER TABLE "SavedItem" ADD COLUMN "galleryAlbumId" TEXT;
ALTER TABLE "SavedItem" ADD COLUMN "transparencyId" TEXT;
ALTER TABLE "SavedItem" ADD COLUMN "contactId" TEXT;

-- CreateIndex (partial unique: NULL != NULL in PostgreSQL so duplicated nulls are fine)
CREATE UNIQUE INDEX "SavedItem_userId_issueId_key" ON "SavedItem"("userId", "issueId");
CREATE UNIQUE INDEX "SavedItem_userId_galleryAlbumId_key" ON "SavedItem"("userId", "galleryAlbumId");
CREATE UNIQUE INDEX "SavedItem_userId_transparencyId_key" ON "SavedItem"("userId", "transparencyId");
CREATE UNIQUE INDEX "SavedItem_userId_contactId_key" ON "SavedItem"("userId", "contactId");

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_galleryAlbumId_fkey" FOREIGN KEY ("galleryAlbumId") REFERENCES "GalleryAlbum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_transparencyId_fkey" FOREIGN KEY ("transparencyId") REFERENCES "TransparencyRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
