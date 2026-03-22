-- AlterTable
ALTER TABLE "User" ADD COLUMN     "citizenVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "registrationDistrict" TEXT,
ADD COLUMN     "registrationProvince" TEXT,
ADD COLUMN     "registrationSubdistrict" TEXT,
ADD COLUMN     "registrationVillageId" TEXT;

-- AlterTable
ALTER TABLE "Village" ADD COLUMN     "subdistrict" TEXT;

-- CreateTable
CREATE TABLE "PhoneRoleSeed" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "villageId" TEXT,
    "membershipRole" "VillageMembershipRole" NOT NULL DEFAULT 'RESIDENT',
    "systemRole" "SystemRole",
    "isCitizenVerified" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneRoleSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneRoleSeed_phoneNumber_key" ON "PhoneRoleSeed"("phoneNumber");

-- CreateIndex
CREATE INDEX "PhoneRoleSeed_villageId_idx" ON "PhoneRoleSeed"("villageId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_registrationVillageId_fkey" FOREIGN KEY ("registrationVillageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneRoleSeed" ADD CONSTRAINT "PhoneRoleSeed_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;
