import "dotenv/config";
import { Client } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const client = new Client({ connectionString: process.env.DATABASE_URL });
const summary = { created: 0, skipped: 0 };

try {
  await client.connect();
  const { rows } = await client.query(`
    SELECT u.id, u."phoneNumber", u."registrationVillageId", r."firstName", r."lastName", r."nationalId"
    FROM "User" u
    JOIN LATERAL (
      SELECT "firstName", "lastName", "nationalId"
      FROM "RegistrationTemp"
      WHERE "phoneNumber" = u."phoneNumber"
        AND status = 'VERIFIED'
        AND "firstName" IS NOT NULL AND "lastName" IS NOT NULL
        AND "nationalId" ~ '^[0-9]{13}$'
      ORDER BY "updatedAt" DESC
      LIMIT 1
    ) r ON true
    LEFT JOIN "Person" p ON p."userId" = u.id
    WHERE p.id IS NULL AND u."accountStatus" = 'ACTIVE'
  `);

  for (const row of rows) {
    await client.query("BEGIN");
    try {
      const created = await client.query(
        `INSERT INTO "Person" (id, "userId", "villageId", "nationalId", "firstName", "lastName", phone, status, "createdAt", "updatedAt")
         VALUES (concat('c', substr(md5(random()::text || clock_timestamp()::text), 1, 24)), $1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
         ON CONFLICT ("userId") DO NOTHING`,
        [row.id, row.registrationVillageId, row.nationalId, row.firstName, row.lastName, row.phoneNumber],
      );
      if (created.rowCount) {
        await client.query('UPDATE "User" SET name = $2, "updatedAt" = NOW() WHERE id = $1', [row.id, `${row.firstName} ${row.lastName}`.trim()]);
        summary.created += 1;
      } else summary.skipped += 1;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      summary.skipped += 1;
      console.warn("Skipped one resident identity record:", error instanceof Error ? error.message : String(error));
    }
  }
} finally {
  await client.end();
}

console.log(`Resident identity backfill complete: created=${summary.created}, skipped=${summary.skipped}`);
