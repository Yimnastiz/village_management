CREATE TYPE "ContactRequestType" AS ENUM ('CREATE', 'UPDATE');

ALTER TABLE "ContactRequest"
  ADD COLUMN "type" "ContactRequestType" NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "targetContactId" TEXT,
  ADD COLUMN "targetSnapshot" JSONB;

ALTER TABLE "ContactRequest"
  ADD CONSTRAINT "ContactRequest_targetContactId_fkey"
  FOREIGN KEY ("targetContactId") REFERENCES "ContactDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContactRequest_targetContactId_requesterId_status_idx"
  ON "ContactRequest"("targetContactId", "requesterId", "status");
