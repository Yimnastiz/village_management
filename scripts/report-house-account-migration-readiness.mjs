import "dotenv/config";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function normalizeEmailForReport(value) {
  return value.trim().toLocaleLowerCase("en-US");
}

function maskEmail(value) {
  const separator = value.lastIndexOf("@");
  if (separator <= 0) return "***";
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

function printCount(label, count) {
  console.log(`${label}: ${count.toLocaleString("en-US")}`);
}

async function main() {
  const [users, houses, personUserLinks, pendingBindingRequests] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        accountKind: true,
        email: true,
        memberships: {
          select: { role: true, status: true, houseId: true },
        },
      },
    }),
    prisma.house.findMany({
      select: {
        id: true,
        houseNumber: true,
        village: { select: { id: true, name: true } },
      },
      orderBy: [{ villageId: "asc" }, { normalizedHouseNumber: "asc" }],
    }),
    prisma.person.count({ where: { userId: { not: null } } }),
    prisma.bindingRequest.count({ where: { status: "PENDING" } }),
  ]);

  const inferredCounts = {
    HEADMAN: 0,
    LEGACY_RESIDENT: 0,
    UNCLASSIFIED: 0,
  };
  const persistedCounts = {
    HEADMAN: 0,
    RESIDENT_HOUSE: 0,
    LEGACY_RESIDENT: 0,
    NULL: 0,
  };
  const activeHeadmanUsers = new Set();
  const activeResidentUsers = new Set();
  const residentsWithHouse = new Set();
  const residentsWithoutHouse = new Set();
  const activeResidentsByHouse = new Map();
  const emailsByNormalizedValue = new Map();
  let usersWithEmail = 0;
  let localInvalidEmails = 0;

  for (const user of users) {
    persistedCounts[user.accountKind ?? "NULL"] += 1;

    const hasActiveHeadmanMembership = user.memberships.some(
      (membership) => membership.role === "HEADMAN" && membership.status === "ACTIVE",
    );
    const hasResidentMembership = user.memberships.some((membership) => membership.role === "RESIDENT");

    if (hasActiveHeadmanMembership) {
      inferredCounts.HEADMAN += 1;
      activeHeadmanUsers.add(user.id);
    } else if (hasResidentMembership) {
      inferredCounts.LEGACY_RESIDENT += 1;
    } else {
      inferredCounts.UNCLASSIFIED += 1;
    }

    for (const membership of user.memberships) {
      if (membership.role !== "RESIDENT" || membership.status !== "ACTIVE") continue;
      activeResidentUsers.add(user.id);
      if (!membership.houseId) {
        residentsWithoutHouse.add(user.id);
        continue;
      }

      residentsWithHouse.add(user.id);
      const current = activeResidentsByHouse.get(membership.houseId) ?? new Set();
      current.add(user.id);
      activeResidentsByHouse.set(membership.houseId, current);
    }

    if (user.email) {
      usersWithEmail += 1;
      const normalized = normalizeEmailForReport(user.email);
      const current = emailsByNormalizedValue.get(normalized) ?? [];
      current.push(user.id);
      emailsByNormalizedValue.set(normalized, current);
      if (normalized.endsWith("@local.invalid")) localInvalidEmails += 1;
    }
  }

  const houseSummaries = houses.map((house) => ({
    ...house,
    residentCount: activeResidentsByHouse.get(house.id)?.size ?? 0,
  }));
  const housesWithNoResident = houseSummaries.filter((house) => house.residentCount === 0);
  const housesWithOneResident = houseSummaries.filter((house) => house.residentCount === 1);
  const conflictingHouses = houseSummaries.filter((house) => house.residentCount > 1);
  const duplicateNormalizedEmails = [...emailsByNormalizedValue.entries()]
    .filter(([, userIds]) => userIds.length > 1)
    .map(([email, userIds]) => ({ email, count: userIds.length }));

  console.log("House Account Migration Readiness");
  console.log("=================================");
  printCount("Total Users", users.length);
  printCount("Active Headmen", activeHeadmanUsers.size);
  printCount("Active Residents", activeResidentUsers.size);
  printCount("Residents with House", residentsWithHouse.size);
  printCount("Residents without House", residentsWithoutHouse.size);

  console.log("\nInferred account kinds");
  printCount("- HEADMAN", inferredCounts.HEADMAN);
  printCount("- LEGACY_RESIDENT", inferredCounts.LEGACY_RESIDENT);
  printCount("- UNCLASSIFIED", inferredCounts.UNCLASSIFIED);

  console.log("\nPersisted account kinds");
  printCount("- HEADMAN", persistedCounts.HEADMAN);
  printCount("- RESIDENT_HOUSE", persistedCounts.RESIDENT_HOUSE);
  printCount("- LEGACY_RESIDENT", persistedCounts.LEGACY_RESIDENT);
  printCount("- NULL", persistedCounts.NULL);

  console.log("\nHouses with active Resident accounts");
  printCount("- 0 Resident accounts", housesWithNoResident.length);
  printCount("- 1 Resident account", housesWithOneResident.length);
  printCount("- multiple Resident accounts", conflictingHouses.length);

  console.log("\nEmail readiness");
  printCount("- Users with email", usersWithEmail);
  printCount("- Users without email", users.length - usersWithEmail);
  printCount("- Unique normalized emails", emailsByNormalizedValue.size);
  printCount("- Duplicate normalized email groups", duplicateNormalizedEmails.length);
  printCount("- @local.invalid emails", localInvalidEmails);

  console.log("\nLegacy links and requests");
  printCount("- Person.userId links", personUserLinks);
  printCount("- Pending BindingRequests", pendingBindingRequests);

  console.log("\nBLOCKERS");
  const blockers = [];
  for (const house of conflictingHouses) {
    blockers.push(
      `House ${house.houseNumber} [${house.id}] in ${house.village.name} [${house.village.id}] has ${house.residentCount} active Resident users.`,
    );
  }
  for (const duplicate of duplicateNormalizedEmails) {
    blockers.push(`Normalized email ${maskEmail(duplicate.email)} is used by ${duplicate.count} Users.`);
  }
  if (persistedCounts.NULL > 0) {
    blockers.push(`${persistedCounts.NULL} Users have no persisted accountKind.`);
  }
  if (residentsWithoutHouse.size > 0) {
    blockers.push(`${residentsWithoutHouse.size} active Resident users do not have a House.`);
  }

  if (blockers.length === 0) console.log("- No represented-data blockers found.");
  else blockers.forEach((blocker) => console.log(`- ${blocker}`));

  console.log("\nRead-only report: no create, update, upsert, or delete operations were executed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
