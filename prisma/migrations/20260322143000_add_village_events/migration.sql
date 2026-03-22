-- CreateTable
CREATE TABLE "VillageEvent" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VillageEvent_villageId_idx" ON "VillageEvent"("villageId");

-- CreateIndex
CREATE INDEX "VillageEvent_startsAt_idx" ON "VillageEvent"("startsAt");

-- CreateIndex
CREATE INDEX "VillageEvent_isPublic_idx" ON "VillageEvent"("isPublic");

-- AddForeignKey
ALTER TABLE "VillageEvent" ADD CONSTRAINT "VillageEvent_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;
