import "dotenv/config";
import process from "node:process";
import { Client } from "pg";

function assertDisposableTarget() {
  if (process.env.HOUSE_ACCOUNT_CUTOVER_TEST !== "true") {
    throw new Error("Refusing to seed: HOUSE_ACCOUNT_CUTOVER_TEST=true is required.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const databaseName = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!databaseName.toLocaleLowerCase("en-US").includes("cutover_test")) {
    throw new Error("Refusing to seed: database name must contain cutover_test.");
  }
}

assertDisposableTarget();
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  await client.query("BEGIN");
  try {
    const now = new Date();
    await client.query(
      `INSERT INTO "Village" ("id", "slug", "name", "isActive", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-village', 'cutover-legacy-village', 'Cutover Legacy Village', TRUE, $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "User" ("id", "phoneNumber", "phoneNumberVerified", "name", "createdAt", "updatedAt") VALUES
       ('cutover-legacy-headman', '0899000001', TRUE, 'Legacy Headman', $1, $1),
       ('cutover-legacy-resident', '0899000002', TRUE, 'Legacy Resident', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "House" ("id", "villageId", "houseNumber", "normalizedHouseNumber", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-house', 'cutover-legacy-village', '9/9', '9/9', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "VillageMembership" ("id", "userId", "villageId", "role", "status", "houseId", "joinedAt", "createdAt", "updatedAt") VALUES
       ('cutover-legacy-headman-membership', 'cutover-legacy-headman', 'cutover-legacy-village', 'HEADMAN', 'ACTIVE', NULL, $1, $1, $1),
       ('cutover-legacy-resident-membership', 'cutover-legacy-resident', 'cutover-legacy-village', 'RESIDENT', 'ACTIVE', 'cutover-legacy-house', $1, $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "Person" ("id", "userId", "houseId", "villageId", "firstName", "lastName", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-person', 'cutover-legacy-resident', 'cutover-legacy-house', 'cutover-legacy-village', 'Legacy', 'Person', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "BindingRequest" ("id", "userId", "villageId", "houseId", "houseNumber", "status", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-binding', 'cutover-legacy-resident', 'cutover-legacy-village', 'cutover-legacy-house', '9/9', 'PENDING', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "Notification" ("id", "villageId", "userId", "type", "status", "title", "createdAt")
       VALUES ('cutover-legacy-notification', 'cutover-legacy-village', 'cutover-legacy-resident', 'SYSTEM', 'UNREAD', 'Legacy notification', $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "Appointment" ("id", "villageId", "userId", "title", "stage", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-appointment', 'cutover-legacy-village', 'cutover-legacy-resident', 'Legacy appointment', 'PENDING_APPROVAL', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "Issue" ("id", "villageId", "reporterId", "title", "description", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-issue', 'cutover-legacy-village', 'cutover-legacy-resident', 'Legacy issue', 'Preserve ownership', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "News" ("id", "villageId", "title", "content", "stage", "visibility", "createdAt", "updatedAt")
       VALUES ('cutover-legacy-news', 'cutover-legacy-village', 'Legacy news', 'Legacy content', 'PUBLISHED', 'RESIDENT_ONLY', $1, $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "SavedItem" ("id", "userId", "newsId", "createdAt")
       VALUES ('cutover-legacy-saved', 'cutover-legacy-resident', 'cutover-legacy-news', $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query(
      `INSERT INTO "AuditLog" ("id", "villageId", "userId", "action", "resource", "resourceId", "createdAt")
       VALUES ('cutover-legacy-audit', 'cutover-legacy-village', 'cutover-legacy-resident', 'CREATE', 'LegacyFixture', 'cutover-legacy-resident', $1)
       ON CONFLICT ("id") DO NOTHING`,
      [now],
    );
    await client.query("COMMIT");
    console.log(JSON.stringify({ seeded: true, fixture: "pre-house-account-upgrade", containsPII: false }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => undefined));
