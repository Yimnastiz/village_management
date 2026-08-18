import "dotenv/config";
import process from "node:process";
import { Client } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(`
    SELECT p.id, p."userId", p."villageId", p."firstName", p."lastName", p."createdAt"
    FROM "Person" p
    JOIN "AuditLog" a ON a."userId" = p."userId" AND a."villageId" IS NOT DISTINCT FROM p."villageId"
    WHERE p."userId" IS NOT NULL
      AND p."houseId" IS NULL
      AND p.status = 'ACTIVE'
      AND a.resource = 'Person'
      AND a.metadata->>'source' = 'REGISTRATION'
      AND NOT EXISTS (SELECT 1 FROM "PersonMovement" m WHERE m."personId" = p.id)
      AND NOT EXISTS (SELECT 1 FROM "VillageMembership" vm WHERE vm."userId" = p."userId" AND vm."villageId" = p."villageId" AND vm.status = 'ACTIVE')
    ORDER BY p."createdAt" ASC
  `);
  console.log(JSON.stringify({ candidates: result.rows, count: result.rowCount, note: "Read-only report. Review each row before any corrective action; unbound manual/imported people are intentionally not targeted without the registration audit evidence." }, null, 2));
} finally {
  await client.end();
}
