CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ContactRequest" (
  "id" TEXT NOT NULL,
  "villageId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "address" TEXT,
  "category" TEXT,
  "note" TEXT,
  "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectReason" TEXT,
  "approvedContactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContactRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ContactRequest_villageId_status_idx" ON "ContactRequest"("villageId", "status");
CREATE INDEX "ContactRequest_requesterId_createdAt_idx" ON "ContactRequest"("requesterId", "createdAt");
CREATE INDEX "ContactRequest_approvedContactId_idx" ON "ContactRequest"("approvedContactId");

-- Preserve live requests created before the dedicated workflow table. Invalid
-- notification payloads are deliberately left untouched instead of guessing.
INSERT INTO "ContactRequest" (
  "id", "villageId", "requesterId", "name", "role", "phone", "email", "address", "category", "note",
  "status", "reviewedById", "reviewedByName", "reviewedAt", "rejectReason", "approvedContactId", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (n."metadata"->>'requestId')
  n."metadata"->>'requestId', n."villageId", n."userId",
  n."metadata"#>>'{payload,name}', NULLIF(n."metadata"#>>'{payload,role}', ''), n."metadata"#>>'{payload,phone}',
  NULLIF(n."metadata"#>>'{payload,email}', ''), NULLIF(n."metadata"#>>'{payload,address}', ''),
  NULLIF(n."metadata"#>>'{payload,category}', ''), NULLIF(n."metadata"#>>'{payload,note}', ''),
  CASE n."metadata"->>'workflowStatus' WHEN 'APPROVED' THEN 'APPROVED'::"ContactRequestStatus" WHEN 'REJECTED' THEN 'REJECTED'::"ContactRequestStatus" ELSE 'PENDING'::"ContactRequestStatus" END,
  NULLIF(n."metadata"->>'reviewedById', ''), NULLIF(n."metadata"->>'reviewedByName', ''),
  NULLIF(n."metadata"->>'reviewedAt', '')::timestamp(3), NULLIF(n."metadata"->>'rejectReason', ''),
  NULLIF(n."metadata"->>'approvedContactId', ''), n."createdAt", n."createdAt"
FROM "Notification" n
WHERE n."villageId" IS NOT NULL
  AND n."metadata"->>'source' = 'RESIDENT_CONTACT_REQUEST_TRACKING'
  AND n."metadata"->>'requestId' IS NOT NULL
  AND COALESCE(n."metadata"#>>'{payload,name}', '') <> ''
  AND COALESCE(n."metadata"#>>'{payload,phone}', '') <> ''
ORDER BY n."metadata"->>'requestId', n."createdAt" ASC;
