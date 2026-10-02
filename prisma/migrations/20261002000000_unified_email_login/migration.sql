ALTER TABLE "HouseAccountLoginFlow" RENAME TO "AccountLoginFlow";
ALTER TABLE "AccountLoginFlow" DROP COLUMN "houseId", DROP COLUMN "houseNumberHash";

ALTER TABLE "AccountLoginFlow" RENAME CONSTRAINT "HouseAccountLoginFlow_pkey" TO "AccountLoginFlow_pkey";
ALTER INDEX "HouseAccountLoginFlow_challengeId_key" RENAME TO "AccountLoginFlow_challengeId_key";
ALTER INDEX "HouseAccountLoginFlow_ipHash_createdAt_idx" RENAME TO "AccountLoginFlow_ipHash_createdAt_idx";
ALTER INDEX "HouseAccountLoginFlow_emailHash_createdAt_idx" RENAME TO "AccountLoginFlow_emailHash_createdAt_idx";
ALTER INDEX "HouseAccountLoginFlow_expiresAt_idx" RENAME TO "AccountLoginFlow_expiresAt_idx";
