ALTER TYPE "ContactRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ContactRequestType" ADD VALUE IF NOT EXISTS 'DELETE';

ALTER TABLE "ContactRequest" ADD COLUMN "deleteReason" TEXT;

DROP INDEX IF EXISTS "ContactRequest_one_pending_update_per_target_requester";
