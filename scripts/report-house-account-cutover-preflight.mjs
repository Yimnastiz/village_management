import "dotenv/config";
import process from "node:process";
import { Client } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const connection = new URL(process.env.DATABASE_URL);
const schema = connection.searchParams.get("schema") || "public";
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error("DATABASE_URL contains an unsupported schema name");

const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
const blockers = [];
const warnings = [];
const safe = [];

function identifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

async function rows(sql, values = []) {
  return (await client.query(sql, values)).rows;
}

async function scalar(sql, values = []) {
  const result = await rows(sql, values);
  return Number(result[0]?.count ?? 0);
}

async function main() {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  try {
    const tableRows = await rows(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [schema],
    );
    const tables = new Set(tableRows.map((row) => row.table_name));
    const columnRows = await rows(
      `SELECT table_name, column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1`,
      [schema],
    );
    const columns = new Map();
    for (const row of columnRows) {
      const tableColumns = columns.get(row.table_name) ?? new Map();
      tableColumns.set(row.column_name, row.is_nullable === "YES");
      columns.set(row.table_name, tableColumns);
    }
    const hasTable = (name) => tables.has(name);
    const hasColumn = (table, column) => columns.get(table)?.has(column) ?? false;
    const tableCount = async (table, predicate = "TRUE") => hasTable(table)
      ? scalar(`SELECT COUNT(*)::int AS count FROM ${identifier(schema)}.${identifier(table)} WHERE ${predicate}`)
      : 0;

    const migrationCount = await tableCount("_prisma_migrations", '"finished_at" IS NOT NULL AND "rolled_back_at" IS NULL');
    const userCount = await tableCount("User");
    const villageCount = await tableCount("Village");
    const houseCount = await tableCount("House");
    const activeVillageCount = hasTable("Village") && hasColumn("Village", "isActive")
      ? await tableCount("Village", '"isActive" = TRUE')
      : 0;

    const accountKinds = {};
    if (hasTable("User") && hasColumn("User", "accountKind")) {
      const grouped = await rows(
        `SELECT COALESCE("accountKind"::text, 'NULL') AS kind, COUNT(*)::int AS count
         FROM ${identifier(schema)}."User" GROUP BY 1 ORDER BY 1`,
      );
      for (const row of grouped) accountKinds[row.kind] = Number(row.count);
    }

    let activeHeadmen = 0;
    let headmenWithoutPhone = 0;
    let headmenWithHouseAccount = 0;
    let activeResidents = 0;
    let residentsWithoutHouse = 0;
    let conflictingHouses = 0;
    let housesWithNoActiveResident = 0;
    let housesWithOneActiveResident = 0;
    if (hasTable("VillageMembership")) {
      activeHeadmen = await scalar(
        `SELECT COUNT(DISTINCT "userId")::int AS count FROM ${identifier(schema)}."VillageMembership"
         WHERE "role"::text = 'HEADMAN' AND "status"::text = 'ACTIVE'`,
      );
      activeResidents = await tableCount("VillageMembership", `"role"::text = 'RESIDENT' AND "status"::text = 'ACTIVE'`);
      residentsWithoutHouse = await tableCount(
        "VillageMembership",
        `"role"::text = 'RESIDENT' AND "status"::text = 'ACTIVE' AND "houseId" IS NULL`,
      );
      conflictingHouses = await scalar(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT "houseId"
           FROM ${identifier(schema)}."VillageMembership"
           WHERE "role"::text = 'RESIDENT' AND "status"::text = 'ACTIVE' AND "houseId" IS NOT NULL
           GROUP BY "houseId" HAVING COUNT(DISTINCT "userId") > 1
         ) AS conflicts`,
      );
      if (hasTable("House")) {
        const houseGroups = await rows(
          `SELECT resident_count, COUNT(*)::int AS count FROM (
             SELECT house."id", COUNT(DISTINCT membership."userId")::int AS resident_count
             FROM ${identifier(schema)}."House" house
             LEFT JOIN ${identifier(schema)}."VillageMembership" membership
               ON membership."houseId" = house."id"
              AND membership."role"::text = 'RESIDENT'
              AND membership."status"::text = 'ACTIVE'
             GROUP BY house."id"
           ) AS inventory GROUP BY resident_count`,
        );
        housesWithNoActiveResident = Number(houseGroups.find((row) => Number(row.resident_count) === 0)?.count ?? 0);
        housesWithOneActiveResident = Number(houseGroups.find((row) => Number(row.resident_count) === 1)?.count ?? 0);
      }
      if (hasTable("User") && hasColumn("User", "phoneNumber")) {
        headmenWithoutPhone = await scalar(
          `SELECT COUNT(DISTINCT membership."userId")::int AS count
           FROM ${identifier(schema)}."VillageMembership" membership
           JOIN ${identifier(schema)}."User" account_user ON account_user."id" = membership."userId"
           WHERE membership."role"::text = 'HEADMAN' AND membership."status"::text = 'ACTIVE'
             AND account_user."phoneNumber" IS NULL`,
        );
      }
      if (hasTable("ResidentHouseAccount")) {
        headmenWithHouseAccount = await scalar(
          `SELECT COUNT(DISTINCT membership."userId")::int AS count
           FROM ${identifier(schema)}."VillageMembership" membership
           JOIN ${identifier(schema)}."ResidentHouseAccount" house_account ON house_account."userId" = membership."userId"
           WHERE membership."role"::text = 'HEADMAN' AND membership."status"::text = 'ACTIVE'`,
        );
      }
    }

    let duplicateUserEmailGroups = 0;
    let usersWithEmail = 0;
    let syntheticUserEmails = 0;
    if (hasTable("User") && hasColumn("User", "email")) {
      usersWithEmail = await tableCount("User", '"email" IS NOT NULL AND BTRIM("email") <> \'\'');
      syntheticUserEmails = await tableCount("User", `LOWER(BTRIM("email")) LIKE '%@local.invalid'`);
      duplicateUserEmailGroups = await scalar(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT LOWER(BTRIM("email"))
           FROM ${identifier(schema)}."User"
           WHERE "email" IS NOT NULL AND BTRIM("email") <> ''
           GROUP BY LOWER(BTRIM("email")) HAVING COUNT(*) > 1
         ) AS duplicates`,
      );
    }

    let duplicateAliasGroups = 0;
    let canonicalAliasOwnerConflicts = 0;
    let inconsistentAliasOwners = 0;
    if (hasTable("AccountEmail")) {
      duplicateAliasGroups = await scalar(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT "normalizedEmail" FROM ${identifier(schema)}."AccountEmail"
           GROUP BY "normalizedEmail" HAVING COUNT(*) > 1
         ) AS duplicates`,
      );
      if (hasTable("User") && hasColumn("User", "email")) {
        canonicalAliasOwnerConflicts = await scalar(
          `SELECT COUNT(*)::int AS count
           FROM ${identifier(schema)}."AccountEmail" alias
           JOIN ${identifier(schema)}."User" account_user
             ON LOWER(BTRIM(account_user."email")) = alias."normalizedEmail"
           WHERE alias."userId" IS DISTINCT FROM account_user."id"
             AND alias."status"::text <> 'REVOKED'`,
        );
      }
      if (hasTable("ResidentHouseAccount")) {
        inconsistentAliasOwners = await scalar(
          `SELECT COUNT(*)::int AS count
           FROM ${identifier(schema)}."AccountEmail" alias
           LEFT JOIN ${identifier(schema)}."ResidentHouseAccount" house_account
             ON house_account."id" = alias."residentHouseAccountId"
           WHERE alias."status"::text = 'ACTIVE'
             AND (alias."userId" IS NULL
               OR alias."residentHouseAccountId" IS NULL
               OR house_account."userId" IS DISTINCT FROM alias."userId")`,
        );
      }
    }

    const phoneNullable = columns.get("User")?.get("phoneNumber") ?? null;
    const usersWithoutPhone = hasTable("User") && hasColumn("User", "phoneNumber")
      ? await tableCount("User", '"phoneNumber" IS NULL')
      : 0;
    const phoneOnlyLegacyResidents = hasTable("User") && hasTable("VillageMembership") && hasColumn("User", "email")
      ? await scalar(
          `SELECT COUNT(DISTINCT account_user."id")::int AS count
           FROM ${identifier(schema)}."User" account_user
           JOIN ${identifier(schema)}."VillageMembership" membership ON membership."userId" = account_user."id"
           WHERE membership."role"::text = 'RESIDENT'
             AND membership."status"::text = 'ACTIVE'
             AND account_user."phoneNumber" IS NOT NULL
             AND account_user."email" IS NULL`,
        )
      : 0;

    const legacyTables = {};
    for (const table of ["Person", "BindingRequest", "RegistrationTemp", "RegistrationAttempt", "RegistrationOtpChallenge", "PhoneRoleSeed", "LoginOtpChallenge"]) {
      if (!hasTable(table)) continue;
      legacyTables[table] = await tableCount(table);
      if (hasColumn(table, "status")) {
        const grouped = await rows(
          `SELECT "status"::text AS status, COUNT(*)::int AS count
           FROM ${identifier(schema)}.${identifier(table)} GROUP BY 1 ORDER BY 1`,
        );
        legacyTables[`${table}ByStatus`] = Object.fromEntries(grouped.map((row) => [row.status, Number(row.count)]));
      }
    }
    const personUserLinks = hasTable("Person") && hasColumn("Person", "userId")
      ? await tableCount("Person", '"userId" IS NOT NULL')
      : 0;
    const duplicateIdUsers = hasTable("User") && hasColumn("User", "accountStatus")
      ? await tableCount("User", `"accountStatus"::text = 'DUPLICATE_ID'`)
      : 0;
    const citizenVerifiedUsers = hasTable("User") && hasColumn("User", "citizenVerifiedAt")
      ? await tableCount("User", '"citizenVerifiedAt" IS NOT NULL')
      : 0;

    const houseAccountTables = {};
    for (const table of ["ResidentHouseAccount", "HouseAccountOpeningRequest", "AccountEmail", "EmailOtpChallenge", "HouseAccountLoginFlow"]) {
      houseAccountTables[table] = hasTable(table) ? await tableCount(table) : null;
    }

    const ownershipDefinitions = [
      ["Notification", "userId", `"status"::text <> 'ARCHIVED'`],
      ["SavedItem", "userId", "TRUE"],
      ["Appointment", "userId", `"stage"::text NOT IN ('CANCELLED', 'COMPLETED')`],
      ["NewsSubmission", "requesterId", `"status"::text = 'PENDING'`],
      ["VillageEventSubmission", "requesterId", `"status"::text = 'PENDING'`],
      ["GalleryItemSubmission", "requesterId", `"status"::text = 'PENDING'`],
      ["VillagePlaceSubmission", "requesterId", `"status"::text = 'PENDING'`],
      ["ContactRequest", "requesterId", `"status"::text = 'PENDING'`],
      ["Issue", "reporterId", `"stage"::text NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')`],
    ];
    const businessOwnership = {};
    for (const [table, ownerColumn, activePredicate] of ownershipDefinitions) {
      if (!hasTable(table) || !hasColumn(table, ownerColumn)) continue;
      const total = await tableCount(table);
      const active = await tableCount(table, activePredicate);
      let legacyResidentOwned = 0;
      if (hasTable("User") && hasColumn("User", "accountKind")) {
        legacyResidentOwned = await scalar(
          `SELECT COUNT(*)::int AS count
           FROM ${identifier(schema)}.${identifier(table)} item
           JOIN ${identifier(schema)}."User" account_user ON account_user."id" = item.${identifier(ownerColumn)}
           WHERE account_user."accountKind"::text = 'LEGACY_RESIDENT' AND (${activePredicate})`,
        );
      } else if (hasTable("VillageMembership")) {
        legacyResidentOwned = await scalar(
          `SELECT COUNT(*)::int AS count
           FROM ${identifier(schema)}.${identifier(table)} item
           WHERE (${activePredicate}) AND EXISTS (
             SELECT 1 FROM ${identifier(schema)}."VillageMembership" membership
             WHERE membership."userId" = item.${identifier(ownerColumn)}
               AND membership."role"::text = 'RESIDENT'
           )`,
        );
      }
      businessOwnership[table] = { total, active, activeLegacyResidentOwned: legacyResidentOwned };
    }

    const noApplicationData = userCount === 0 && villageCount === 0 && houseCount === 0;
    const unmanagedSchema = hasTable("User") && migrationCount === 0;
    const mode = !hasTable("User")
      ? "FRESH_INSTALL"
      : unmanagedSchema && noApplicationData
        ? "UNMANAGED_EMPTY_SCHEMA"
        : noApplicationData
          ? "MIGRATED_EMPTY_SCHEMA"
          : "EXISTING_DATA";

    if (!hasTable("User")) {
      safe.push("No application schema or data is present; use the fresh-install migration path.");
    } else {
      if (unmanagedSchema) {
        blockers.push("Application tables exist without successful Prisma migration history; choose a clean DEV reset or a deliberate baseline before deploy.");
      }
      if (!noApplicationData && activeVillageCount !== 1) blockers.push(`Expected exactly one active Village; found ${activeVillageCount}.`);
      if (headmenWithoutPhone > 0) blockers.push(`${headmenWithoutPhone} active Headman accounts have no phone number for Headman OTP login.`);
      if (headmenWithHouseAccount > 0) blockers.push(`${headmenWithHouseAccount} active Headman accounts are incorrectly linked to ResidentHouseAccount.`);
      if (conflictingHouses > 0) blockers.push(`${conflictingHouses} House rows have multiple active Resident users.`);
      if (residentsWithoutHouse > 0) blockers.push(`${residentsWithoutHouse} active Resident users have no House.`);
      if (duplicateUserEmailGroups > 0) blockers.push(`${duplicateUserEmailGroups} normalized User.email duplicate groups require resolution.`);
      if (duplicateAliasGroups > 0) blockers.push(`${duplicateAliasGroups} AccountEmail normalized duplicate groups violate global uniqueness.`);
      if (canonicalAliasOwnerConflicts > 0) blockers.push(`${canonicalAliasOwnerConflicts} canonical User emails conflict with another AccountEmail owner.`);
      if (inconsistentAliasOwners > 0) blockers.push(`${inconsistentAliasOwners} active AccountEmail rows have inconsistent House Account ownership.`);
      if ((accountKinds.NULL ?? 0) > 0) blockers.push(`${accountKinds.NULL} User rows have no accountKind after the foundation migration.`);

      if (activeHeadmen === 0) warnings.push("No active Headman account exists; bootstrap is required before opening-request review.");
      if ((accountKinds.LEGACY_RESIDENT ?? activeResidents) > 0) warnings.push("Legacy Resident users require an explicit preserve/merge/archive decision before cutover.");
      if (phoneOnlyLegacyResidents > 0) warnings.push(`${phoneOnlyLegacyResidents} active legacy Residents are phone-only and cannot use email login without remediation.`);
      if (personUserLinks > 0) warnings.push(`${personUserLinks} Person.userId links require a deliberate unlink/preserve policy.`);
      if ((legacyTables.BindingRequestByStatus?.PENDING ?? 0) > 0) warnings.push("Pending BindingRequests require an operator disposition before retiring legacy data.");
      const ownedRows = Object.values(businessOwnership).reduce((sum, value) => sum + value.activeLegacyResidentOwned, 0);
      if (ownedRows > 0) warnings.push(`${ownedRows} business records remain owned by legacy Resident users and need an ownership migration policy.`);
      if (!hasTable("ResidentHouseAccount")) warnings.push("House Account tables are not applied yet; this is expected only before migration deployment.");
      if (noApplicationData && !unmanagedSchema) safe.push("The migrated schema is empty; bootstrap can follow the fresh-install path.");
      if (blockers.length === 0) safe.push("No represented-data cutover blocker was detected by the read-only checks.");
    }

    const report = {
      mode,
      summary: {
        appliedMigrations: migrationCount,
        users: userCount,
        villages: villageCount,
        activeVillages: activeVillageCount,
        houses: houseCount,
        activeHeadmen,
        activeResidents,
        residentsWithoutHouse,
        conflictingHouses,
        housesWithNoActiveResident,
        housesWithOneActiveResident,
      },
      accountKinds,
      headmanReadiness: { activeHeadmen, headmenWithoutPhone, headmenWithHouseAccount },
      emailReadiness: {
        usersWithEmail,
        usersWithoutEmail: userCount - usersWithEmail,
        syntheticUserEmails,
        duplicateUserEmailGroups,
        duplicateAliasGroups,
        canonicalAliasOwnerConflicts,
        inconsistentAliasOwners,
      },
      phoneReadiness: { phoneNullable, usersWithoutPhone, phoneOnlyLegacyResidents },
      houseAccountTables,
      legacyTables,
      personUserLinks,
      duplicateIdUsers,
      citizenVerifiedUsers,
      businessOwnership,
      classification: {
        result: blockers.length ? "BLOCKER" : warnings.length ? "WARNING" : "SAFE",
        blockers,
        warnings,
        safe,
      },
      guarantee: "Read-only transaction; no create, update, upsert, delete, DDL, seed, or migration operation was executed.",
    };
    console.log(JSON.stringify(report, null, 2));
    await client.query("ROLLBACK");
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
