-- Preserve request history while enforcing one active pending request per user.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "userId"
    ORDER BY "createdAt" DESC, "id" DESC
  ) AS row_number
  FROM "BindingRequest"
  WHERE "status" = 'PENDING'
)
UPDATE "BindingRequest" AS request
SET "status" = 'CANCELLED',
    "reviewNote" = COALESCE(request."reviewNote", 'ยกเลิกคำขอซ้ำระหว่างปรับปรุงระบบ')
FROM ranked
WHERE request."id" = ranked."id" AND ranked.row_number > 1;

CREATE UNIQUE INDEX "BindingRequest_one_pending_per_user"
ON "BindingRequest" ("userId")
WHERE "status" = 'PENDING';
