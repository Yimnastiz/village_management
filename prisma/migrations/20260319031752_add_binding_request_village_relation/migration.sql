-- CreateIndex
CREATE INDEX "BindingRequest_villageId_idx" ON "BindingRequest"("villageId");

-- AddForeignKey
ALTER TABLE "BindingRequest" ADD CONSTRAINT "BindingRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;
