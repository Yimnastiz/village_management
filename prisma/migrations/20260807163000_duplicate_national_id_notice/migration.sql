ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "duplicateOfUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "duplicateResolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "duplicateReason" TEXT,
  ADD COLUMN IF NOT EXISTS "duplicateNoticeLoginUsedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "duplicateNoticeSeenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_accountStatus_duplicateNoticeSeenAt_idx"
  ON "User"("accountStatus", "duplicateNoticeSeenAt");
