import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { maskEmail, normalizeAccountEmail } from "@/lib/account-email";
import { sanitizeResidentCallbackUrl } from "@/lib/callback-url";
import { getConfiguredVillage } from "@/lib/configured-village";
import { hashEmailOtpAbuseContext } from "@/lib/email/email-otp-crypto";
import { readEmailOtpConfig } from "@/lib/email/email-otp-config";
import {
  consumeVerifiedEmailOtpChallenge,
  issueEmailOtpChallenge,
  resendEmailOtpChallenge,
  verifyEmailOtpChallenge,
  type EmailOtpClientContext,
} from "@/lib/email/email-otp-service";
import {
  HOUSE_LOGIN_FLOW_TTL_SECONDS,
  readHouseLoginFlowCookie,
  verifyHouseLoginFlowToken,
} from "@/lib/house-account-login-access";
import { houseLoginEligibility } from "@/lib/house-account-login-policy";
import { normalizeHouseNumber } from "@/lib/house-number";
import { prisma } from "@/lib/prisma";

export type HouseAccountLoginErrorCode =
  | "FLOW_NOT_FOUND"
  | "FLOW_EXPIRED"
  | "INVALID_CODE"
  | "OTP_UNAVAILABLE"
  | "ACCOUNT_UNAVAILABLE"
  | "RATE_LIMITED";

export class HouseAccountLoginError extends Error {
  constructor(readonly code: HouseAccountLoginErrorCode, message: string) {
    super(message);
    this.name = "HouseAccountLoginError";
  }
}

type LoginDb = Pick<
  Prisma.TransactionClient,
  "accountEmail" | "authSession" | "auditLog" | "houseAccountLoginFlow"
>;

type EligibleIdentity = {
  accountEmailId: string;
  userId: string;
  residentHouseAccountId: string;
  villageId: string;
  houseId: string;
  houseNumber: string;
  email: string;
  normalizedEmail: string;
};

type PublicFlow = {
  flowId: string;
  maskedEmail: string;
  expiresAt: Date;
  resendAvailableAt: Date;
};

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function flowFromRow(flow: {
  id: string;
  maskedEmail: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}): PublicFlow {
  return {
    flowId: flow.id,
    maskedEmail: flow.maskedEmail,
    expiresAt: flow.expiresAt,
    resendAvailableAt: flow.resendAvailableAt,
  };
}

async function resolveIdentityByAlias(
  db: LoginDb,
  input: {
    accountEmailId: string;
    enteredHouseId: string;
    configuredVillageId: string;
  },
): Promise<EligibleIdentity | null> {
  const alias = await db.accountEmail.findUnique({
    where: { id: input.accountEmailId },
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      status: true,
      verifiedAt: true,
      activatedAt: true,
      revokedAt: true,
      userId: true,
      residentHouseAccountId: true,
      user: {
        select: {
          id: true,
          accountKind: true,
          accountStatus: true,
          memberships: {
            where: {
              villageId: input.configuredVillageId,
              role: "RESIDENT",
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              role: true,
              status: true,
              villageId: true,
              houseId: true,
            },
          },
        },
      },
      residentHouseAccount: {
        select: {
          id: true,
          userId: true,
          villageId: true,
          houseId: true,
          activatedAt: true,
          suspendedAt: true,
          house: {
            select: {
              villageId: true,
              houseNumber: true,
            },
          },
        },
      },
    },
  });
  const account = alias?.residentHouseAccount;
  const user = alias?.user;
  if (!alias || !account || !user) return null;
  const membership = user.memberships[0] ?? null;
  const eligibility = houseLoginEligibility({
    accountEmailStatus: alias.status,
    accountEmailVerifiedAt: alias.verifiedAt,
    accountEmailActivatedAt: alias.activatedAt,
    accountEmailRevokedAt: alias.revokedAt,
    accountEmailUserId: alias.userId,
    accountEmailHouseAccountId: alias.residentHouseAccountId,
    houseAccountId: account.id,
    houseAccountUserId: account.userId,
    houseAccountVillageId: account.villageId,
    houseAccountHouseId: account.houseId,
    houseAccountActivatedAt: account.activatedAt,
    houseAccountSuspendedAt: account.suspendedAt,
    houseVillageId: account.house.villageId,
    configuredVillageId: input.configuredVillageId,
    enteredHouseId: input.enteredHouseId,
    userAccountKind: user.accountKind,
    userAccountStatus: user.accountStatus,
    membershipRole: membership?.role ?? null,
    membershipStatus: membership?.status ?? null,
    membershipVillageId: membership?.villageId ?? null,
    membershipHouseId: membership?.houseId ?? null,
  });
  if (eligibility !== "ELIGIBLE") {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[house-login] eligibility rejected", { eligibility });
    }
    return null;
  }
  return {
    accountEmailId: alias.id,
    userId: user.id,
    residentHouseAccountId: account.id,
    villageId: account.villageId,
    houseId: account.houseId,
    houseNumber: account.house.houseNumber,
    email: alias.email,
    normalizedEmail: alias.normalizedEmail,
  };
}

async function resolveIdentityForStart(input: {
  configuredVillageId: string;
  normalizedHouseNumber: string;
  normalizedEmail: string;
}): Promise<EligibleIdentity | null> {
  const [house, alias] = await Promise.all([
    prisma.house.findUnique({
      where: {
        villageId_normalizedHouseNumber: {
          villageId: input.configuredVillageId,
          normalizedHouseNumber: input.normalizedHouseNumber,
        },
      },
      select: { id: true },
    }),
    prisma.accountEmail.findUnique({
      where: { normalizedEmail: input.normalizedEmail },
      select: { id: true },
    }),
  ]);
  if (!house || !alias) return null;
  return resolveIdentityByAlias(prisma, {
    accountEmailId: alias.id,
    enteredHouseId: house.id,
    configuredVillageId: input.configuredVillageId,
  });
}

function requestIp(context: EmailOtpClientContext): string | null {
  return context.ipAddress?.split(",")[0]?.trim() || null;
}

export async function startHouseAccountLogin(
  input: { houseNumber: string; email: string; callbackUrl?: string | null },
  context: EmailOtpClientContext,
): Promise<PublicFlow> {
  const configuredVillage = await getConfiguredVillage();
  const config = readEmailOtpConfig();
  const now = new Date();
  const normalizedHouseNumber = normalizeHouseNumber(input.houseNumber);
  const normalizedEmail = normalizeAccountEmail(input.email);
  const maskedEmail = maskEmail(normalizedEmail);
  const ipHash = hashEmailOtpAbuseContext(requestIp(context), config.hashSecret);
  const emailHash = hashEmailOtpAbuseContext(normalizedEmail, config.hashSecret);
  const houseNumberHash = hashEmailOtpAbuseContext(normalizedHouseNumber, config.hashSecret);
  const rateWindowStart = new Date(now.getTime() - config.rateWindowSeconds * 1_000);
  const [ipAttempts, emailAttempts] = await Promise.all([
    ipHash
      ? prisma.houseAccountLoginFlow.count({ where: { ipHash, createdAt: { gte: rateWindowStart } } })
      : Promise.resolve(0),
    emailHash
      ? prisma.houseAccountLoginFlow.count({ where: { emailHash, createdAt: { gte: rateWindowStart } } })
      : Promise.resolve(0),
  ]);
  if (ipAttempts >= config.maxRequestsPerIp || emailAttempts >= config.maxRequestsPerEmail) {
    throw new HouseAccountLoginError("RATE_LIMITED", "House login request limit reached.");
  }

  const flowId = randomUUID();
  const fallbackExpiresAt = new Date(now.getTime() + HOUSE_LOGIN_FLOW_TTL_SECONDS * 1_000);
  const fallbackResendAt = new Date(now.getTime() + config.resendSeconds * 1_000);
  const flow = await prisma.houseAccountLoginFlow.create({
    data: {
      id: flowId,
      callbackUrl: sanitizeResidentCallbackUrl(input.callbackUrl),
      maskedEmail,
      ipHash,
      emailHash,
      houseNumberHash,
      expiresAt: fallbackExpiresAt,
      resendAvailableAt: fallbackResendAt,
    },
  });

  const syntacticallyValid = normalizedHouseNumber.length > 0
    && normalizedHouseNumber.length <= 50
    && EMAIL_PATTERN.test(normalizedEmail)
    && normalizedEmail.length <= 320;
  const identity = syntacticallyValid
    ? await resolveIdentityForStart({
        configuredVillageId: configuredVillage.id,
        normalizedHouseNumber,
        normalizedEmail,
      })
    : null;
  if (!identity) return flowFromRow(flow);

  try {
    const challenge = await issueEmailOtpChallenge({
      email: identity.email,
      purpose: "HOUSE_LOGIN",
      accountEmailId: identity.accountEmailId,
      userId: identity.userId,
      context,
    });
    const updated = await prisma.houseAccountLoginFlow.update({
      where: { id: flow.id },
      data: {
        challengeId: challenge.challengeId,
        houseId: identity.houseId,
        accountEmailId: identity.accountEmailId,
        expiresAt: challenge.expiresAt,
        resendAvailableAt: challenge.resendAvailableAt,
      },
    });
    return flowFromRow(updated);
  } catch (error) {
    // Delivery/configuration/rate failures intentionally keep this as a decoy
    // flow. The public response remains indistinguishable from bad credentials.
    console.error("[house-login] OTP was not issued", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return flowFromRow(flow);
  }
}

function flowIdFromHeaders(headers: Headers): string | null {
  const token = readHouseLoginFlowCookie(headers.get("cookie"));
  return verifyHouseLoginFlowToken(token)?.flowId ?? null;
}

async function loadOwnedFlow(headers: Headers, claimedFlowId?: string | null) {
  const flowId = flowIdFromHeaders(headers);
  if (!flowId || (claimedFlowId && claimedFlowId !== flowId)) {
    throw new HouseAccountLoginError("FLOW_NOT_FOUND", "House login flow was not found.");
  }
  const flow = await prisma.houseAccountLoginFlow.findUnique({ where: { id: flowId } });
  if (!flow || flow.cancelledAt || flow.completedAt) {
    throw new HouseAccountLoginError("FLOW_NOT_FOUND", "House login flow was not found.");
  }
  if (flow.expiresAt <= new Date()) {
    throw new HouseAccountLoginError("FLOW_EXPIRED", "House login flow has expired.");
  }
  return flow;
}

export async function getHouseAccountLoginStatus(headers: Headers): Promise<PublicFlow> {
  return flowFromRow(await loadOwnedFlow(headers));
}

export async function resendHouseAccountLoginOtp(
  headers: Headers,
  claimedFlowId: string,
  context: EmailOtpClientContext,
): Promise<PublicFlow> {
  const flow = await loadOwnedFlow(headers, claimedFlowId);
  if (!flow.challengeId || !flow.houseId || !flow.accountEmailId) return flowFromRow(flow);
  const configuredVillage = await getConfiguredVillage();
  const identity = await resolveIdentityByAlias(prisma, {
    accountEmailId: flow.accountEmailId,
    enteredHouseId: flow.houseId,
    configuredVillageId: configuredVillage.id,
  });
  if (!identity) return flowFromRow(flow);
  try {
    const challenge = await resendEmailOtpChallenge({
      challengeId: flow.challengeId,
      email: identity.email,
      context,
    });
    const updated = await prisma.houseAccountLoginFlow.update({
      where: { id: flow.id },
      data: {
        expiresAt: challenge.expiresAt,
        resendAvailableAt: challenge.resendAvailableAt,
      },
    });
    return flowFromRow(updated);
  } catch {
    return flowFromRow(flow);
  }
}

export async function cancelHouseAccountLogin(headers: Headers, claimedFlowId?: string | null): Promise<void> {
  const flow = await loadOwnedFlow(headers, claimedFlowId);
  await prisma.$transaction(async (tx) => {
    await tx.houseAccountLoginFlow.update({
      where: { id: flow.id },
      data: { cancelledAt: new Date() },
    });
    if (flow.challengeId) {
      await tx.emailOtpChallenge.updateMany({
        where: {
          id: flow.challengeId,
          purpose: "HOUSE_LOGIN",
          status: { in: ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] },
        },
        data: { status: "CANCELLED" },
      });
    }
  });
}

export async function verifyHouseAccountLoginOtp(
  headers: Headers,
  input: { flowId: string; code: string },
): Promise<EligibleIdentity & { callbackUrl: string; challengeId: string }> {
  const flow = await loadOwnedFlow(headers, input.flowId);
  if (!flow.challengeId || !flow.houseId || !flow.accountEmailId) {
    throw new HouseAccountLoginError("INVALID_CODE", "Unable to verify the login code.");
  }
  let verified;
  try {
    verified = await verifyEmailOtpChallenge({ challengeId: flow.challengeId, code: input.code });
  } catch {
    throw new HouseAccountLoginError("INVALID_CODE", "Unable to verify the login code.");
  }
  if (
    verified.purpose !== "HOUSE_LOGIN"
    || verified.accountEmailId !== flow.accountEmailId
    || !verified.userId
  ) {
    throw new HouseAccountLoginError("OTP_UNAVAILABLE", "Unable to verify the login code.");
  }
  const configuredVillage = await getConfiguredVillage();
  const identity = await resolveIdentityByAlias(prisma, {
    accountEmailId: flow.accountEmailId,
    enteredHouseId: flow.houseId,
    configuredVillageId: configuredVillage.id,
  });
  if (!identity || identity.userId !== verified.userId) {
    await prisma.emailOtpChallenge.updateMany({
      where: { id: flow.challengeId, status: "VERIFIED" },
      data: { status: "CANCELLED" },
    });
    throw new HouseAccountLoginError("ACCOUNT_UNAVAILABLE", "House account is unavailable.");
  }
  return {
    ...identity,
    challengeId: flow.challengeId,
    callbackUrl: sanitizeResidentCallbackUrl(flow.callbackUrl, "/resident/dashboard")
      ?? "/resident/dashboard",
  };
}

export async function consumeHouseAccountLoginOtp(input: {
  flowId: string;
  challengeId: string;
  sessionId: string;
  sessionToken: string;
  identity: EligibleIdentity;
}): Promise<void> {
  const configuredVillage = await getConfiguredVillage();
  await consumeVerifiedEmailOtpChallenge(input.challengeId, {
    apply: async (tx, challenge) => {
      const flow = await tx.houseAccountLoginFlow.findUnique({ where: { id: input.flowId } });
      if (
        !flow
        || flow.completedAt
        || flow.cancelledAt
        || flow.challengeId !== challenge.challengeId
        || flow.houseId !== input.identity.houseId
        || flow.accountEmailId !== input.identity.accountEmailId
        || challenge.purpose !== "HOUSE_LOGIN"
        || challenge.accountEmailId !== input.identity.accountEmailId
        || challenge.userId !== input.identity.userId
      ) throw new HouseAccountLoginError("OTP_UNAVAILABLE", "House login challenge is unavailable.");

      const currentIdentity = await resolveIdentityByAlias(tx, {
        accountEmailId: input.identity.accountEmailId,
        enteredHouseId: input.identity.houseId,
        configuredVillageId: configuredVillage.id,
      });
      if (!currentIdentity || currentIdentity.userId !== input.identity.userId) {
        throw new HouseAccountLoginError("ACCOUNT_UNAVAILABLE", "House account is unavailable.");
      }

      const attributed = await tx.authSession.updateMany({
        where: {
          id: input.sessionId,
          token: input.sessionToken,
          userId: input.identity.userId,
        },
        data: {
          activeVillageId: input.identity.villageId,
          loginAccountEmailId: input.identity.accountEmailId,
        },
      });
      if (attributed.count !== 1) {
        throw new HouseAccountLoginError("ACCOUNT_UNAVAILABLE", "Session attribution failed.");
      }
      await tx.houseAccountLoginFlow.update({
        where: { id: flow.id },
        data: { completedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          villageId: input.identity.villageId,
          userId: input.identity.userId,
          action: "LOGIN",
          resource: "AuthSession",
          resourceId: input.sessionId,
          metadata: {
            actorRole: "RESIDENT",
            accountKind: "RESIDENT_HOUSE",
            actionName: "HOUSE_ACCOUNT_EMAIL_LOGIN_SUCCEEDED",
            houseId: input.identity.houseId,
            houseNumber: input.identity.houseNumber,
            loginAccountEmailId: input.identity.accountEmailId,
            maskedEmail: maskEmail(input.identity.email),
          },
        },
      });
    },
  });
}

/** Revoking an alias should call this helper in the next email-management phase. */
export async function revokeSessionsForAccountEmail(
  accountEmailId: string,
  db: Pick<Prisma.TransactionClient, "authSession"> = prisma,
): Promise<number> {
  const result = await db.authSession.deleteMany({ where: { loginAccountEmailId: accountEmailId } });
  return result.count;
}
