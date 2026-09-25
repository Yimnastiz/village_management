import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";

function assertDisposableTarget() {
  if (process.env.HOUSE_ACCOUNT_CUTOVER_TEST !== "true") {
    throw new Error("Refusing to verify: HOUSE_ACCOUNT_CUTOVER_TEST=true is required.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const url = new URL(process.env.DATABASE_URL);
  const databaseName = url.pathname.slice(1).toLocaleLowerCase("en-US");
  if (!databaseName.includes("cutover_test") || databaseName === "village_management") {
    throw new Error("Refusing to verify: database name must be a disposable cutover_test database.");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to verify in NODE_ENV=production.");
}

assertDisposableTarget();
process.env.EMAIL_PROVIDER = "console";
process.env.EMAIL_OTP_HASH_SECRET ||= "cutover-test-email-otp-secret-32-characters";
process.env.BETTER_AUTH_SECRET ||= "cutover-test-better-auth-secret-32-characters";
process.env.EMAIL_OTP_RESEND_SECONDS ||= "10";

const otpDeliveries = [];
const originalConsoleLog = console.log;
console.log = (...values) => {
  if (values[0] === "[EMAIL OTP DEV]" && values[1]?.code) {
    otpDeliveries.push({ purpose: values[1].purpose, code: values[1].code });
    return;
  }
  originalConsoleLog(...values);
};

const { prisma } = await import("../src/lib/prisma.ts");
const {
  startHouseAccountOpening,
  verifyHouseAccountOpeningEmail,
  cancelHouseAccountOpening,
} = await import("../src/lib/house-account-opening-service.ts");
const { approveAndActivateHouseAccount } = await import("../src/lib/house-account-opening-review-service.ts");
const {
  startHouseAccountEmailAddition,
  verifyHouseAccountEmailAddition,
  cancelHouseAccountEmailAddition,
  removeHouseAccountEmail,
} = await import("../src/lib/house-account-email-management-service.ts");
const {
  startHouseAccountLogin,
  verifyHouseAccountLoginOtp,
  consumeHouseAccountLoginOtp,
} = await import("../src/lib/house-account-login-service.ts");
const { createHouseLoginFlowToken, HOUSE_LOGIN_FLOW_COOKIE } = await import("../src/lib/house-account-login-access.ts");
const { InMemoryEmailProvider } = await import("../src/lib/email/email-provider-contract.ts");

function takeOtp(purpose) {
  const index = otpDeliveries.findLastIndex((delivery) => delivery.purpose === purpose);
  assert.notEqual(index, -1, `Expected an in-memory ${purpose} OTP delivery`);
  return otpDeliveries.splice(index, 1)[0].code;
}

function errorCode(result) {
  return result.status === "rejected" && result.reason && typeof result.reason === "object"
    ? result.reason.code
    : null;
}

async function expectUniqueViolation(operation, label) {
  let rejected = false;
  try {
    await operation();
  } catch (error) {
    rejected = error?.code === "P2002";
  }
  assert.equal(rejected, true, label);
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  const report = { schema: {}, services: {}, concurrency: {}, preservation: {} };

  const activeVillages = await prisma.village.findMany({ where: { isActive: true }, take: 2 });
  assert.ok(activeVillages.length <= 1, "Disposable fixture must have at most one active Village");
  const village = activeVillages[0] ?? await prisma.village.create({
    data: { slug: `cutover-${runId}`, name: "Cutover Test Village", isActive: true },
  });

  let headmanMembership = await prisma.villageMembership.findFirst({
    where: { villageId: village.id, role: "HEADMAN", status: "ACTIVE" },
    include: { user: true },
  });
  if (!headmanMembership) {
    const headman = await prisma.user.create({
      data: { name: "Cutover Headman", phoneNumber: `08${runId.replace(/\D/g, "").padEnd(8, "7").slice(0, 8)}`, phoneNumberVerified: true, accountKind: "HEADMAN" },
    });
    headmanMembership = await prisma.villageMembership.create({
      data: { userId: headman.id, villageId: village.id, role: "HEADMAN", status: "ACTIVE", joinedAt: new Date() },
      include: { user: true },
    });
  }

  const makeHouse = (suffix) => prisma.house.create({
    data: {
      villageId: village.id,
      houseNumber: `cutover-${runId}-${suffix}`,
      normalizedHouseNumber: `cutover-${runId}-${suffix}`.toUpperCase(),
      sourceType: "SEED",
    },
  });
  const houses = await Promise.all(["primary", "approve", "same-house", "email-a", "email-b", "constraint"].map(makeHouse));
  const [primaryHouse, approvalHouse, sameHouse, emailHouseA, emailHouseB, constraintHouse] = houses;

  async function openAndVerify(house, email, ipAddress) {
    const opening = await startHouseAccountOpening({
      houseId: house.id,
      applicantFirstName: "Cutover",
      applicantLastName: "Applicant",
      contactPhone: "0891111111",
      email,
      privacyConsent: true,
    }, { ipAddress, userAgent: "house-account-cutover-verifier" });
    const code = takeOtp("HOUSE_OPENING");
    await verifyHouseAccountOpeningEmail(opening.requestId, opening.challengeId, code);
    return opening;
  }

  const primaryOpening = await openAndVerify(primaryHouse, `primary-${runId}@example.test`, "127.0.0.11");
  const decisionProvider = new InMemoryEmailProvider();
  const primaryDecision = await approveAndActivateHouseAccount(
    headmanMembership.userId,
    primaryOpening.requestId,
    { emailProvider: decisionProvider },
  );
  assert.equal(primaryDecision.outcome, "ACTIVATED");
  const primaryAccount = await prisma.residentHouseAccount.findUniqueOrThrow({
    where: { houseId: primaryHouse.id },
    include: { user: true, accountEmails: true },
  });
  assert.equal(primaryAccount.user.accountKind, "RESIDENT_HOUSE");
  assert.equal(primaryAccount.user.phoneNumber, null);
  assert.equal(primaryAccount.accountEmails.filter((email) => email.status === "ACTIVE").length, 1);
  assert.equal(await prisma.person.count({ where: { userId: primaryAccount.userId } }), 0);
  const initialAlias = primaryAccount.accountEmails.find((email) => email.status === "ACTIVE");
  assert.ok(initialAlias);
  report.services.openingApprovalActivation = "PASS";
  assert.ok(headmanMembership.user.phoneNumber);
  assert.equal(headmanMembership.user.accountKind, "HEADMAN");
  report.services.headmanCompatibility = "PASS";

  const managementSessionRow = await prisma.authSession.create({
    data: {
      userId: primaryAccount.userId,
      token: `cutover-management-${runId}`,
      expiresAt: new Date(Date.now() + 3_600_000),
      activeVillageId: village.id,
      loginAccountEmailId: initialAlias.id,
    },
  });
  const managementSession = {
    authSessionId: managementSessionRow.id,
    id: primaryAccount.userId,
    phoneNumber: null,
    name: primaryAccount.user.name,
    accountKind: "RESIDENT_HOUSE",
    accountStatus: "ACTIVE",
    activeVillageId: village.id,
    loginAccountEmailId: initialAlias.id,
    residentHouseAccount: {
      villageId: village.id,
      houseId: primaryHouse.id,
      activatedAt: primaryAccount.activatedAt,
      suspendedAt: null,
    },
    memberships: [{ villageId: village.id, villageSlug: village.slug, houseId: primaryHouse.id, role: "RESIDENT", status: "ACTIVE" }],
  };
  const aliasEmail = `alias-${runId}@example.test`;
  const addition = await startHouseAccountEmailAddition(managementSession, aliasEmail, {
    ipAddress: "127.0.0.12",
    userAgent: "house-account-cutover-verifier",
  });
  const additionFlow = {
    version: 1,
    authSessionId: managementSession.authSessionId,
    userId: managementSession.id,
    residentHouseAccountId: primaryAccount.id,
    accountEmailId: addition.accountEmail.id,
    challengeId: addition.challengeId,
    expiresAt: addition.expiresAt.getTime(),
  };
  await verifyHouseAccountEmailAddition(managementSession, additionFlow, takeOtp("ADD_HOUSE_EMAIL"));
  const aliases = await prisma.accountEmail.findMany({
    where: { residentHouseAccountId: primaryAccount.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(aliases.length, 2);
  report.services.additionalEmail = "PASS";

  async function login(alias, sequence) {
    const flow = await startHouseAccountLogin({ houseNumber: primaryHouse.houseNumber, email: alias.email }, {
      ipAddress: `127.0.0.${20 + sequence}`,
      userAgent: "house-account-cutover-verifier",
    });
    const persistedFlow = await prisma.houseAccountLoginFlow.findUniqueOrThrow({ where: { id: flow.flowId } });
    assert.ok(persistedFlow.challengeId, "A valid alias must create a real HOUSE_LOGIN challenge");
    const token = createHouseLoginFlowToken(flow.flowId, flow.expiresAt);
    const headers = new Headers({ cookie: `${HOUSE_LOGIN_FLOW_COOKIE}=${encodeURIComponent(token)}` });
    const identity = await verifyHouseAccountLoginOtp(headers, { flowId: flow.flowId, code: takeOtp("HOUSE_LOGIN") });
    const session = await prisma.authSession.create({
      data: {
        userId: identity.userId,
        token: `cutover-login-${runId}-${sequence}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    await consumeHouseAccountLoginOtp({
      flowId: flow.flowId,
      challengeId: identity.challengeId,
      sessionId: session.id,
      sessionToken: session.token,
      identity,
    });
    return { identity, sessionId: session.id };
  }

  const loginOne = await login(initialAlias, 1);
  const loginTwo = await login(aliases.find((email) => email.id !== initialAlias.id), 2);
  assert.equal(loginOne.identity.userId, loginTwo.identity.userId);
  assert.notEqual(loginOne.identity.accountEmailId, loginTwo.identity.accountEmailId);
  const attributedSessions = await prisma.authSession.findMany({
    where: { id: { in: [loginOne.sessionId, loginTwo.sessionId] } },
    select: { id: true, loginAccountEmailId: true },
  });
  assert.equal(attributedSessions.filter((session) => session.loginAccountEmailId).length, 2);
  report.services.multiAliasLoginAndAttribution = "PASS";

  const concurrentAliasEmail = `parallel-alias-${runId}@example.test`;
  const concurrentAliasResults = await Promise.allSettled([
    startHouseAccountEmailAddition(managementSession, concurrentAliasEmail, { ipAddress: "127.0.0.36" }),
    startHouseAccountEmailAddition(managementSession, concurrentAliasEmail.toUpperCase(), { ipAddress: "127.0.0.37" }),
  ]);
  assert.equal(await prisma.accountEmail.count({ where: { normalizedEmail: concurrentAliasEmail } }), 1);
  assert.ok(concurrentAliasResults.some((result) => result.status === "fulfilled"));
  assert.ok(await prisma.emailOtpChallenge.count({
    where: {
      normalizedEmail: concurrentAliasEmail,
      purpose: "ADD_HOUSE_EMAIL",
      status: { in: ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] },
    },
  }) <= 1);
  const fulfilledAlias = concurrentAliasResults.find((result) => result.status === "fulfilled");
  if (fulfilledAlias) {
    const pending = fulfilledAlias.value;
    await cancelHouseAccountEmailAddition(managementSession, {
      version: 1,
      authSessionId: managementSession.authSessionId,
      userId: managementSession.id,
      residentHouseAccountId: primaryAccount.id,
      accountEmailId: pending.accountEmail.id,
      challengeId: pending.challengeId,
      expiresAt: pending.expiresAt.getTime(),
    });
  }
  report.concurrency.sameAliasAddition = "PASS";
  report.concurrency.oneLiveEmailOtpChallenge = "PASS";

  const aliasTwo = aliases.find((email) => email.id !== initialAlias.id);
  const sessionContext = (authSessionId, loginAccountEmailId) => ({
    ...managementSession,
    authSessionId,
    loginAccountEmailId,
  });
  const aliasTwoSession = sessionContext(loginTwo.sessionId, aliasTwo.id);
  const userIdBeforeRotation = primaryAccount.userId;
  await removeHouseAccountEmail(aliasTwoSession, initialAlias.id);
  assert.equal(await prisma.authSession.count({ where: { id: loginOne.sessionId } }), 0);
  assert.equal(await prisma.authSession.count({ where: { id: loginTwo.sessionId } }), 1);
  const userAfterRotation = await prisma.user.findUniqueOrThrow({ where: { id: primaryAccount.userId } });
  assert.equal(userAfterRotation.id, userIdBeforeRotation);
  assert.equal(userAfterRotation.email, aliasTwo.email);
  assert.equal((await prisma.residentHouseAccount.findUniqueOrThrow({ where: { id: primaryAccount.id } })).userId, userIdBeforeRotation);
  let lastAliasProtected = false;
  try {
    await removeHouseAccountEmail(aliasTwoSession, aliasTwo.id);
  } catch (error) {
    lastAliasProtected = error?.code === "LAST_ACTIVE_EMAIL";
  }
  assert.equal(lastAliasProtected, true);
  report.services.aliasRemovalSessionRevocation = "PASS";
  report.services.canonicalEmailRotation = "PASS";
  report.services.finalAliasProtection = "PASS";

  const thirdAddition = await startHouseAccountEmailAddition(aliasTwoSession, `third-${runId}@example.test`, {
    ipAddress: "127.0.0.38",
    userAgent: "house-account-cutover-verifier",
  });
  await verifyHouseAccountEmailAddition(aliasTwoSession, {
    version: 1,
    authSessionId: aliasTwoSession.authSessionId,
    userId: aliasTwoSession.id,
    residentHouseAccountId: primaryAccount.id,
    accountEmailId: thirdAddition.accountEmail.id,
    challengeId: thirdAddition.challengeId,
    expiresAt: thirdAddition.expiresAt.getTime(),
  }, takeOtp("ADD_HOUSE_EMAIL"));
  const aliasThree = await prisma.accountEmail.findUniqueOrThrow({ where: { id: thirdAddition.accountEmail.id } });
  const loginThree = await login(aliasThree, 3);
  const aliasThreeSession = sessionContext(loginThree.sessionId, aliasThree.id);
  const finalRemovalResults = await Promise.allSettled([
    removeHouseAccountEmail(aliasThreeSession, aliasTwo.id),
    removeHouseAccountEmail(aliasTwoSession, aliasThree.id),
  ]);
  assert.equal(finalRemovalResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await prisma.accountEmail.count({ where: { residentHouseAccountId: primaryAccount.id, status: "ACTIVE" } }), 1);
  report.concurrency.simultaneousFinalEmailRemoval = "PASS";

  const concurrentOpeningResults = await Promise.allSettled([
    startHouseAccountOpening({ houseId: sameHouse.id, applicantFirstName: "Same", applicantLastName: "House A", contactPhone: "0892222222", email: `same-a-${runId}@example.test`, privacyConsent: true }, { ipAddress: "127.0.0.31" }),
    startHouseAccountOpening({ houseId: sameHouse.id, applicantFirstName: "Same", applicantLastName: "House B", contactPhone: "0893333333", email: `same-b-${runId}@example.test`, privacyConsent: true }, { ipAddress: "127.0.0.32" }),
  ]);
  assert.equal(concurrentOpeningResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(concurrentOpeningResults.some((result) => errorCode(result) === "HOUSE_REQUEST_ALREADY_PENDING"));
  assert.equal(await prisma.houseAccountOpeningRequest.count({ where: { houseId: sameHouse.id, status: { in: ["PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW"] } } }), 1);
  await cancelHouseAccountOpening(concurrentOpeningResults.find((result) => result.status === "fulfilled").value.requestId);
  report.concurrency.oneLiveOpeningPerHouse = "PASS";

  const contestedEmail = `contested-${runId}@example.test`;
  const concurrentEmailResults = await Promise.allSettled([
    startHouseAccountOpening({ houseId: emailHouseA.id, applicantFirstName: "Email", applicantLastName: "House A", contactPhone: "0894444444", email: contestedEmail, privacyConsent: true }, { ipAddress: "127.0.0.33" }),
    startHouseAccountOpening({ houseId: emailHouseB.id, applicantFirstName: "Email", applicantLastName: "House B", contactPhone: "0895555555", email: contestedEmail.toUpperCase(), privacyConsent: true }, { ipAddress: "127.0.0.34" }),
  ]);
  assert.equal(concurrentEmailResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(concurrentEmailResults.some((result) => errorCode(result) === "EMAIL_UNAVAILABLE"));
  assert.equal(await prisma.accountEmail.count({ where: { normalizedEmail: contestedEmail } }), 1);
  await cancelHouseAccountOpening(concurrentEmailResults.find((result) => result.status === "fulfilled").value.requestId);
  report.concurrency.globalEmailReservation = "PASS";

  const approvalOpening = await openAndVerify(approvalHouse, `approval-${runId}@example.test`, "127.0.0.35");
  const approvalResults = await Promise.allSettled([
    approveAndActivateHouseAccount(headmanMembership.userId, approvalOpening.requestId, { emailProvider: decisionProvider }),
    approveAndActivateHouseAccount(headmanMembership.userId, approvalOpening.requestId, { emailProvider: decisionProvider }),
  ]);
  assert.equal(approvalResults.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(await prisma.residentHouseAccount.count({ where: { houseId: approvalHouse.id } }), 1);
  const approvedRequest = await prisma.houseAccountOpeningRequest.findUniqueOrThrow({ where: { id: approvalOpening.requestId } });
  assert.equal(approvedRequest.status, "APPROVED");
  report.concurrency.idempotentApproval = "PASS";

  const conflictingUser = await prisma.user.create({ data: { name: "Constraint User", accountKind: "RESIDENT_HOUSE" } });
  await expectUniqueViolation(
    () => prisma.residentHouseAccount.create({ data: { userId: conflictingUser.id, villageId: village.id, houseId: primaryHouse.id, contactPhone: "0896666666" } }),
    "ResidentHouseAccount.houseId must be unique",
  );
  await expectUniqueViolation(
    () => prisma.residentHouseAccount.create({ data: { userId: primaryAccount.userId, villageId: village.id, houseId: constraintHouse.id, contactPhone: "0897777777" } }),
    "ResidentHouseAccount.userId must be unique",
  );
  await expectUniqueViolation(
    () => prisma.accountEmail.create({ data: { email: initialAlias.email.toUpperCase(), normalizedEmail: initialAlias.normalizedEmail, source: "RECOVERY", status: "REVOKED" } }),
    "AccountEmail.normalizedEmail must be globally unique",
  );
  report.schema.uniqueConstraints = "PASS";

  const indexRows = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [
      "ResidentHouseAccount_userId_key",
      "ResidentHouseAccount_houseId_key",
      "HouseAccountOpeningRequest_one_active_per_house",
      "AccountEmail_normalizedEmail_key",
      "EmailOtpChallenge_one_live_per_email_purpose",
      "AuthSession_loginAccountEmailId_idx",
    ],
  );
  assert.equal(indexRows.length, 6);
  const phoneColumn = await prisma.$queryRawUnsafe(
    `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'phoneNumber'`,
  );
  assert.equal(phoneColumn[0]?.is_nullable, "YES");
  report.schema.migrationShape = "PASS";
  report.schema.nullableResidentPhone = "PASS";

  const setNullAlias = await prisma.accountEmail.create({
    data: { email: `set-null-${runId}@example.test`, normalizedEmail: `set-null-${runId}@example.test`, source: "RECOVERY", status: "REVOKED" },
  });
  const setNullSession = await prisma.authSession.create({
    data: { userId: headmanMembership.userId, token: `cutover-set-null-${runId}`, expiresAt: new Date(Date.now() + 3_600_000), loginAccountEmailId: setNullAlias.id },
  });
  await prisma.accountEmail.delete({ where: { id: setNullAlias.id } });
  assert.equal((await prisma.authSession.findUniqueOrThrow({ where: { id: setNullSession.id } })).loginAccountEmailId, null);
  report.schema.authSessionAliasSetNull = "PASS";

  assert.ok(await prisma.auditLog.count({ where: { resource: { in: ["HouseAccountOpeningRequest", "AccountEmail", "AuthSession"] } } }) > 0);
  assert.ok(await prisma.notification.count({ where: { villageId: village.id } }) > 0);
  report.services.auditAndNotifications = "PASS";

  const usersBeforePopulation = await prisma.user.count();
  const membershipsBeforePopulation = await prisma.villageMembership.count();
  const populationPerson = await prisma.person.create({
    data: {
      villageId: village.id,
      houseId: constraintHouse.id,
      firstName: "Population",
      lastName: "Only",
      phone: "0898888888",
    },
  });
  assert.equal(populationPerson.userId, null);
  assert.equal(await prisma.user.count(), usersBeforePopulation);
  assert.equal(await prisma.villageMembership.count(), membershipsBeforePopulation);
  report.services.populationPersonSeparation = "PASS";

  const legacyUser = await prisma.user.findUnique({ where: { id: "cutover-legacy-resident" } });
  if (legacyUser) {
    assert.equal(legacyUser.accountKind, "LEGACY_RESIDENT");
    assert.ok(legacyUser.phoneNumber);
    assert.equal(await prisma.person.count({ where: { id: "cutover-legacy-person", userId: legacyUser.id } }), 1);
    assert.equal(await prisma.bindingRequest.count({ where: { id: "cutover-legacy-binding", status: "PENDING" } }), 1);
    assert.equal(await prisma.notification.count({ where: { id: "cutover-legacy-notification", userId: legacyUser.id } }), 1);
    assert.equal(await prisma.appointment.count({ where: { id: "cutover-legacy-appointment", userId: legacyUser.id } }), 1);
    assert.equal(await prisma.issue.count({ where: { id: "cutover-legacy-issue", reporterId: legacyUser.id } }), 1);
    assert.equal(await prisma.savedItem.count({ where: { id: "cutover-legacy-saved", userId: legacyUser.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { id: "cutover-legacy-audit", userId: legacyUser.id } }), 1);
    report.preservation.preHouseAccountFixture = "PASS";
  } else {
    report.preservation.preHouseAccountFixture = "NOT_PRESENT_FRESH_CHAIN";
  }

  originalConsoleLog(JSON.stringify({ result: "PASS", ...report }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log = originalConsoleLog;
    await prisma.$disconnect();
  });
