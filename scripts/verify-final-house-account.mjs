import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { canRemoveAccountEmail } from "../src/lib/house-account-email-policy.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const databaseName = new URL(connectionString).pathname.slice(1);
if (!/(?:test|fresh)/i.test(databaseName) || process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run outside a disposable non-production test database.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const now = new Date();

try {
  assert.equal(await prisma.user.count(), 0, "verification database must start without Users");
  assert.equal(await prisma.person.count(), 0, "verification database must start without Persons");

  const village = await prisma.village.create({ data: { slug: `phase11-${randomUUID()}`, name: "Phase 11 Village", isActive: true } });
  const headman = await prisma.user.create({ data: { name: "Phase 11 Headman", phoneNumber: "0811111111", phoneNumberVerified: true, accountKind: "HEADMAN" } });
  await prisma.villageMembership.create({ data: { userId: headman.id, villageId: village.id, role: "HEADMAN", status: "ACTIVE", joinedAt: now } });
  const house = await prisma.house.create({ data: { villageId: village.id, houseNumber: "168/4", normalizedHouseNumber: "168/4" } });

  const opening = await prisma.houseAccountOpeningRequest.create({
    data: { villageId: village.id, houseId: house.id, applicantFirstName: "ผู้สมัคร", applicantLastName: "ทดสอบ", contactPhone: "0822222222", emailSnapshot: "mom@example.test", normalizedEmailSnapshot: "mom@example.test", status: "PENDING_REVIEW", requestedAt: now },
  });
  const firstAlias = await prisma.accountEmail.create({ data: { email: "mom@example.test", normalizedEmail: "mom@example.test", source: "OPENING_REQUEST", status: "VERIFIED_PENDING_REVIEW", openingRequestId: opening.id, verifiedAt: now } });
  const openingOtp = await prisma.emailOtpChallenge.create({ data: { normalizedEmail: firstAlias.normalizedEmail, purpose: "HOUSE_OPENING", accountEmailId: firstAlias.id, codeHash: "verified-test-hash", codeSalt: "verified-test-salt", status: "VERIFIED", expiresAt: new Date(now.getTime() + 300_000), verifiedAt: now, maxAttempts: 5, maxResends: 5 } });

  const activated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: `บ้านเลขที่ ${house.houseNumber}`, email: firstAlias.email, emailVerified: true, accountKind: "RESIDENT_HOUSE" } });
    const houseAccount = await tx.residentHouseAccount.create({ data: { userId: user.id, villageId: village.id, houseId: house.id, contactPhone: opening.contactPhone, activatedAt: now } });
    await tx.villageMembership.create({ data: { userId: user.id, villageId: village.id, houseId: house.id, role: "RESIDENT", status: "ACTIVE", joinedAt: now } });
    await tx.accountEmail.update({ where: { id: firstAlias.id }, data: { userId: user.id, residentHouseAccountId: houseAccount.id, status: "ACTIVE", activatedAt: now } });
    await tx.emailOtpChallenge.update({ where: { id: openingOtp.id }, data: { status: "CONSUMED", consumedAt: now, userId: user.id } });
    await tx.houseAccountOpeningRequest.update({ where: { id: opening.id }, data: { status: "APPROVED", reviewedAt: now, reviewedByUserId: headman.id, activatedUserId: user.id } });
    return { user, houseAccount };
  });

  const secondAlias = await prisma.accountEmail.create({ data: { email: "dad@example.test", normalizedEmail: "dad@example.test", source: "HOUSE_ACCOUNT", status: "ACTIVE", userId: activated.user.id, residentHouseAccountId: activated.houseAccount.id, verifiedAt: now, activatedAt: now, createdByUserId: activated.user.id } });
  const aliases = await prisma.accountEmail.findMany({ where: { normalizedEmail: { in: ["mom@example.test", "dad@example.test"] }, status: "ACTIVE" } });
  assert.equal(aliases.length, 2);
  assert.deepEqual(new Set(aliases.map((alias) => alias.userId)), new Set([activated.user.id]));
  assert.deepEqual(new Set(aliases.map((alias) => alias.residentHouseAccountId)), new Set([activated.houseAccount.id]));

  await prisma.authSession.createMany({ data: aliases.map((alias) => ({ userId: activated.user.id, token: randomUUID(), expiresAt: new Date(now.getTime() + 3_600_000), activeVillageId: village.id, loginAccountEmailId: alias.id })) });
  assert.equal(await prisma.authSession.count({ where: { userId: activated.user.id } }), 2);
  assert.equal(canRemoveAccountEmail(2), true);
  await prisma.$transaction([prisma.authSession.deleteMany({ where: { loginAccountEmailId: secondAlias.id } }), prisma.accountEmail.update({ where: { id: secondAlias.id }, data: { status: "REVOKED", revokedAt: new Date() } })]);
  assert.equal(await prisma.authSession.count({ where: { loginAccountEmailId: secondAlias.id } }), 0);
  assert.equal(await prisma.authSession.count({ where: { loginAccountEmailId: firstAlias.id } }), 1);
  assert.equal(canRemoveAccountEmail(await prisma.accountEmail.count({ where: { residentHouseAccountId: activated.houseAccount.id, status: "ACTIVE" } })), false);

  const beforePopulation = { users: await prisma.user.count(), houseAccounts: await prisma.residentHouseAccount.count(), emails: await prisma.accountEmail.count() };
  const person = await prisma.person.create({ data: { villageId: village.id, houseId: house.id, firstName: "ประชากร", lastName: "ทดสอบ", nationalId: "1101700203450", phone: "0833333333", email: "person@example.test" } });
  assert.equal(person.nationalId, "1101700203450");
  assert.deepEqual({ users: await prisma.user.count(), houseAccounts: await prisma.residentHouseAccount.count(), emails: await prisma.accountEmail.count() }, beforePopulation);

  const finalHouseAccount = await prisma.residentHouseAccount.findUniqueOrThrow({ where: { houseId: house.id }, include: { user: true } });
  assert.equal(finalHouseAccount.user.accountKind, "RESIDENT_HOUSE");
  assert.equal(finalHouseAccount.user.name, "บ้านเลขที่ 168/4");
  console.log("Final House Account database verification passed.");
} finally {
  await prisma.$disconnect();
}
