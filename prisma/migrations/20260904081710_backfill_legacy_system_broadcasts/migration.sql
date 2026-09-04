-- This is an empty migration.
-- Backfill the first-class history record from existing broadcast delivery rows.
-- Legacy rows retain their original group ID, which becomes the broadcast ID.
INSERT INTO "SystemBroadcast" (
  "id", "title", "body", "status", "expiresAt", "cancelledAt", "audienceCount", "createdAt", "updatedAt"
)
SELECT
  n."metadata"->>'broadcastGroupId',
  (array_agg(n."title" ORDER BY n."createdAt" DESC))[1],
  COALESCE((array_agg(n."body" ORDER BY n."createdAt" DESC))[1], ''),
  CASE WHEN bool_and(n."status" = 'ARCHIVED') THEN 'CANCELLED'::"SystemBroadcastStatus" ELSE 'ACTIVE'::"SystemBroadcastStatus" END,
  NULLIF(n."metadata"->>'expiresAt', '')::timestamp,
  CASE WHEN bool_and(n."status" = 'ARCHIVED') THEN max(n."createdAt") ELSE NULL END,
  count(DISTINCT n."userId")::integer,
  min(n."createdAt"),
  max(n."createdAt")
FROM "Notification" n
WHERE n."type" = 'SYSTEM'
  AND n."metadata"->>'source' = 'SUPERADMIN_BROADCAST'
  AND COALESCE(n."metadata"->>'broadcastGroupId', '') <> ''
GROUP BY n."metadata"->>'broadcastGroupId', n."metadata"->>'expiresAt'
ON CONFLICT ("id") DO NOTHING;

UPDATE "Notification" n
SET "systemBroadcastId" = n."metadata"->>'broadcastGroupId'
WHERE n."systemBroadcastId" IS NULL
  AND n."type" = 'SYSTEM'
  AND n."metadata"->>'source' = 'SUPERADMIN_BROADCAST'
  AND EXISTS (
    SELECT 1 FROM "SystemBroadcast" b
    WHERE b."id" = n."metadata"->>'broadcastGroupId'
  );
