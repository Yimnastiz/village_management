import "dotenv/config";
import process from "node:process";
import { Client } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const userId = process.argv[2];
if (!userId) throw new Error("Usage: npm run identity:duplicate-report -- <duplicate-user-id>");

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const [user, revocations, registrations] = await Promise.all([
    client.query(`
      SELECT id, name, "accountStatus", "duplicateOfUserId", "duplicateResolvedAt", "duplicateReason",
             "duplicateNoticeLoginUsedAt", "duplicateNoticeSeenAt", "registrationVillageId"
      FROM "User" WHERE id = $1
    `, [userId]),
    client.query(`
      SELECT "createdAt", action, "resourceId", "villageId", metadata
      FROM "AuditLog"
      WHERE action IN ('REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT', 'APPROVE_RESIDENT_WITH_NATIONAL_ID')
        AND ("resourceId" = $1 OR metadata->>'targetUserId' = $1)
      ORDER BY "createdAt" ASC
    `, [userId]),
    client.query(`
      SELECT id, "userId", "phoneNumber", status, "villageId", "createdAt", "updatedAt", "rejectedAt"
      FROM "RegistrationTemp"
      WHERE "userId" = $1
      ORDER BY "createdAt" ASC
    `, [userId]),
  ]);

  console.log(JSON.stringify({
    user: user.rows[0] ?? null,
    revocationAudit: revocations.rows,
    ownedRegistrations: registrations.rows,
    note: "Read-only report. Unowned legacy RegistrationTemp rows are intentionally excluded from identity matching.",
  }, null, 2));
} finally {
  await client.end();
}
