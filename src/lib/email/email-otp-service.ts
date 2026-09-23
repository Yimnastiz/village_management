import {
  Prisma,
  type EmailOtpChallenge,
  type EmailOtpPurpose,
} from "@prisma/client";
import { normalizeAccountEmail } from "@/lib/account-email";
import { prisma } from "@/lib/prisma";
import {
  generateEmailOtp,
  hashEmailOtp,
  hashEmailOtpAbuseContext,
  verifyEmailOtpHash,
} from "./email-otp-crypto";
import { readEmailOtpConfig, type EmailOtpConfig } from "./email-otp-config";
import {
  emailOtpResendEligibility,
  emailOtpVerificationEligibility,
  failedEmailOtpAttempt,
} from "./email-otp-policy";
import type { EmailProvider } from "./email-provider-contract";
import { getEmailProvider } from "./email-provider";

const LIVE_STATUSES = ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] as const;

export type EmailOtpServiceErrorCode =
  | "INVALID_EMAIL"
  | "CHALLENGE_NOT_FOUND"
  | "CHALLENGE_UNAVAILABLE"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_LOCKED"
  | "INVALID_CODE"
  | "RESEND_COOLDOWN"
  | "MAX_RESENDS"
  | "RATE_LIMITED"
  | "DELIVERY_FAILED"
  | "CHALLENGE_SUPERSEDED"
  | "ACCOUNT_EMAIL_MISMATCH";

export class EmailOtpServiceError extends Error {
  constructor(
    readonly code: EmailOtpServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmailOtpServiceError";
  }
}

export type EmailOtpClientContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type IssuedEmailOtpChallenge = {
  challengeId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
};

export type VerifiedEmailOtpChallenge = {
  challengeId: string;
  normalizedEmail: string;
  purpose: EmailOtpPurpose;
  accountEmailId: string | null;
  userId: string | null;
  verifiedAt: Date;
};

export type EmailOtpConsumptionContext = VerifiedEmailOtpChallenge & {
  expiresAt: Date;
};

type ServiceDependencies = {
  config?: EmailOtpConfig;
  provider?: EmailProvider;
  now?: Date;
};

function validatedEmail(email: string): { deliveryEmail: string; normalizedEmail: string } {
  const deliveryEmail = email.trim();
  const normalizedEmail = normalizeAccountEmail(deliveryEmail);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 320) {
    throw new EmailOtpServiceError("INVALID_EMAIL", "A valid email address is required.");
  }
  return { deliveryEmail, normalizedEmail };
}

function contextHashes(context: EmailOtpClientContext, secret: string) {
  return {
    ipHash: hashEmailOtpAbuseContext(context.ipAddress, secret),
    userAgentHash: hashEmailOtpAbuseContext(context.userAgent, secret),
  };
}

async function lockKeys(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

async function lockChallengeRow(
  tx: Prisma.TransactionClient,
  challengeId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "EmailOtpChallenge" WHERE "id" = ${challengeId} FOR UPDATE`;
}

function publicChallenge(challenge: EmailOtpChallenge): IssuedEmailOtpChallenge {
  if (!challenge.resendAvailableAt) {
    throw new EmailOtpServiceError("CHALLENGE_UNAVAILABLE", "Challenge has no resend policy.");
  }
  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: challenge.resendAvailableAt,
  };
}

async function validateOptionalIdentityLink(
  tx: Prisma.TransactionClient,
  input: { normalizedEmail: string; accountEmailId?: string | null; userId?: string | null },
): Promise<void> {
  if (!input.accountEmailId) return;
  const identity = await tx.accountEmail.findUnique({
    where: { id: input.accountEmailId },
    select: { normalizedEmail: true, userId: true },
  });
  if (
    !identity
    || identity.normalizedEmail !== input.normalizedEmail
    || (input.userId && identity.userId && identity.userId !== input.userId)
  ) {
    throw new EmailOtpServiceError(
      "ACCOUNT_EMAIL_MISMATCH",
      "AccountEmail does not match the requested email identity.",
    );
  }
}

async function markDeliveryResult(input: {
  challengeId: string;
  delivered: boolean;
  sentAt: Date;
}): Promise<EmailOtpChallenge | null> {
  const targetStatus = input.delivered ? "ACTIVE" : "DELIVERY_FAILED";
  const updated = await prisma.emailOtpChallenge.updateMany({
    where: { id: input.challengeId, status: "PENDING_DELIVERY" },
    data: input.delivered
      ? { status: targetStatus, lastSentAt: input.sentAt }
      : { status: targetStatus },
  });
  if (updated.count !== 1) return null;
  return prisma.emailOtpChallenge.findUnique({ where: { id: input.challengeId } });
}

export async function issueEmailOtpChallenge(
  input: {
    email: string;
    purpose: EmailOtpPurpose;
    accountEmailId?: string | null;
    userId?: string | null;
    context?: EmailOtpClientContext;
  },
  dependencies: ServiceDependencies = {},
): Promise<IssuedEmailOtpChallenge> {
  const config = dependencies.config ?? readEmailOtpConfig();
  const provider = dependencies.provider ?? getEmailProvider();
  const issuedAt = dependencies.now ?? new Date();
  const email = validatedEmail(input.email);
  const hashes = contextHashes(input.context ?? {}, config.hashSecret);
  const code = generateEmailOtp();
  const protectedCode = await hashEmailOtp({
    code,
    normalizedEmail: email.normalizedEmail,
    purpose: input.purpose,
    secret: config.hashSecret,
  });
  const expiresAt = new Date(issuedAt.getTime() + config.ttlSeconds * 1_000);
  const resendAvailableAt = new Date(issuedAt.getTime() + config.resendSeconds * 1_000);
  const rateWindowStart = new Date(issuedAt.getTime() - config.rateWindowSeconds * 1_000);

  const challenge = await prisma.$transaction(async (tx) => {
    await lockKeys(tx, [
      `email-otp:${email.normalizedEmail}:${input.purpose}`,
      ...(hashes.ipHash ? [`email-otp-ip:${hashes.ipHash}`] : []),
    ]);
    await validateOptionalIdentityLink(tx, {
      normalizedEmail: email.normalizedEmail,
      accountEmailId: input.accountEmailId,
      userId: input.userId,
    });

    const [emailRequests, ipRequests] = await Promise.all([
      tx.emailOtpChallenge.count({
        where: { normalizedEmail: email.normalizedEmail, createdAt: { gte: rateWindowStart } },
      }),
      hashes.ipHash
        ? tx.emailOtpChallenge.count({
            where: { ipHash: hashes.ipHash, createdAt: { gte: rateWindowStart } },
          })
        : Promise.resolve(0),
    ]);
    if (
      emailRequests >= config.maxRequestsPerEmail
      || (hashes.ipHash && ipRequests >= config.maxRequestsPerIp)
    ) {
      throw new EmailOtpServiceError("RATE_LIMITED", "Email OTP request limit reached.");
    }

    await tx.emailOtpChallenge.updateMany({
      where: {
        normalizedEmail: email.normalizedEmail,
        purpose: input.purpose,
        status: { in: [...LIVE_STATUSES] },
      },
      data: { status: "CANCELLED" },
    });

    return tx.emailOtpChallenge.create({
      data: {
        normalizedEmail: email.normalizedEmail,
        purpose: input.purpose,
        accountEmailId: input.accountEmailId ?? null,
        userId: input.userId ?? null,
        ...protectedCode,
        status: "PENDING_DELIVERY",
        expiresAt,
        maxAttempts: config.maxAttempts,
        maxResends: config.maxResends,
        resendAvailableAt,
        ...hashes,
      },
    });
  });

  try {
    await provider.sendOtp({
      to: email.deliveryEmail,
      code,
      purpose: input.purpose,
      ttlSeconds: config.ttlSeconds,
    });
  } catch (error) {
    await markDeliveryResult({ challengeId: challenge.id, delivered: false, sentAt: issuedAt });
    throw new EmailOtpServiceError(
      "DELIVERY_FAILED",
      error instanceof Error ? `Email OTP delivery failed: ${error.message}` : "Email OTP delivery failed.",
    );
  }

  const active = await markDeliveryResult({
    challengeId: challenge.id,
    delivered: true,
    sentAt: issuedAt,
  });
  if (!active) {
    throw new EmailOtpServiceError(
      "CHALLENGE_SUPERSEDED",
      "The Email OTP challenge was superseded before delivery completed.",
    );
  }
  return publicChallenge(active);
}

export async function resendEmailOtpChallenge(
  input: {
    challengeId: string;
    email: string;
    context?: EmailOtpClientContext;
  },
  dependencies: ServiceDependencies = {},
): Promise<IssuedEmailOtpChallenge> {
  const config = dependencies.config ?? readEmailOtpConfig();
  const provider = dependencies.provider ?? getEmailProvider();
  const sentAt = dependencies.now ?? new Date();
  const email = validatedEmail(input.email);
  const hashes = contextHashes(input.context ?? {}, config.hashSecret);
  const code = generateEmailOtp();

  const challenge = await prisma.emailOtpChallenge.findUnique({
    where: { id: input.challengeId },
    select: { normalizedEmail: true, purpose: true },
  });
  if (!challenge || challenge.normalizedEmail !== email.normalizedEmail) {
    throw new EmailOtpServiceError("CHALLENGE_NOT_FOUND", "Email OTP challenge was not found.");
  }
  const protectedCode = await hashEmailOtp({
    code,
    normalizedEmail: challenge.normalizedEmail,
    purpose: challenge.purpose,
    secret: config.hashSecret,
  });
  const expiresAt = new Date(sentAt.getTime() + config.ttlSeconds * 1_000);
  const resendAvailableAt = new Date(sentAt.getTime() + config.resendSeconds * 1_000);

  const pending = await prisma.$transaction(async (tx) => {
    await lockKeys(tx, [`email-otp:${challenge.normalizedEmail}:${challenge.purpose}`]);
    await lockChallengeRow(tx, input.challengeId);
    const current = await tx.emailOtpChallenge.findUnique({ where: { id: input.challengeId } });
    if (!current || current.normalizedEmail !== email.normalizedEmail) {
      throw new EmailOtpServiceError("CHALLENGE_NOT_FOUND", "Email OTP challenge was not found.");
    }
    const eligibility = emailOtpResendEligibility(current, sentAt);
    if (eligibility === "EXPIRED") {
      throw new EmailOtpServiceError("CHALLENGE_EXPIRED", "Email OTP challenge has expired.");
    }
    if (eligibility === "COOLDOWN") {
      throw new EmailOtpServiceError("RESEND_COOLDOWN", "Email OTP resend cooldown is active.");
    }
    if (eligibility === "MAX_RESENDS") {
      throw new EmailOtpServiceError("MAX_RESENDS", "Email OTP resend limit reached.");
    }
    if (eligibility !== "OK") {
      throw new EmailOtpServiceError("CHALLENGE_UNAVAILABLE", "Email OTP challenge cannot be resent.");
    }

    return tx.emailOtpChallenge.update({
      where: { id: current.id },
      data: {
        ...protectedCode,
        status: "PENDING_DELIVERY",
        expiresAt,
        verifiedAt: null,
        consumedAt: null,
        attemptCount: 0,
        resendCount: { increment: 1 },
        resendAvailableAt,
        ...hashes,
      },
    });
  });

  try {
    await provider.sendOtp({
      to: email.deliveryEmail,
      code,
      purpose: pending.purpose,
      ttlSeconds: config.ttlSeconds,
    });
  } catch (error) {
    await markDeliveryResult({ challengeId: pending.id, delivered: false, sentAt });
    throw new EmailOtpServiceError(
      "DELIVERY_FAILED",
      error instanceof Error ? `Email OTP delivery failed: ${error.message}` : "Email OTP delivery failed.",
    );
  }

  const active = await markDeliveryResult({ challengeId: pending.id, delivered: true, sentAt });
  if (!active) {
    throw new EmailOtpServiceError(
      "CHALLENGE_SUPERSEDED",
      "The Email OTP challenge was superseded before delivery completed.",
    );
  }
  return publicChallenge(active);
}

export async function verifyEmailOtpChallenge(input: {
  challengeId: string;
  code: string;
  now?: Date;
}): Promise<VerifiedEmailOtpChallenge> {
  const config = readEmailOtpConfig();
  const now = input.now ?? new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    await lockChallengeRow(tx, input.challengeId);
    const challenge = await tx.emailOtpChallenge.findUnique({ where: { id: input.challengeId } });
    if (!challenge) return { kind: "NOT_FOUND" } as const;

    const eligibility = emailOtpVerificationEligibility(challenge, now);
    if (eligibility === "EXPIRED") {
      await tx.emailOtpChallenge.updateMany({
        where: { id: challenge.id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      return { kind: "EXPIRED" } as const;
    }
    if (eligibility === "LOCKED") {
      if (challenge.status === "ACTIVE") {
        await tx.emailOtpChallenge.update({
          where: { id: challenge.id },
          data: { status: "LOCKED" },
        });
      }
      return { kind: "LOCKED" } as const;
    }
    if (eligibility !== "OK") return { kind: "UNAVAILABLE" } as const;

    const matches = await verifyEmailOtpHash({
      code: input.code,
      normalizedEmail: challenge.normalizedEmail,
      purpose: challenge.purpose,
      secret: config.hashSecret,
      codeHash: challenge.codeHash,
      codeSalt: challenge.codeSalt,
    });
    if (!matches) {
      const failed = failedEmailOtpAttempt(challenge.attemptCount, challenge.maxAttempts);
      await tx.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: failed,
      });
      return { kind: failed.status === "LOCKED" ? "LOCKED" : "INVALID" } as const;
    }

    const verifiedAt = now;
    const verified = await tx.emailOtpChallenge.update({
      where: { id: challenge.id },
      data: { status: "VERIFIED", verifiedAt },
    });
    return { kind: "VERIFIED", challenge: verified, verifiedAt } as const;
  });

  if (outcome.kind === "NOT_FOUND") {
    throw new EmailOtpServiceError("CHALLENGE_NOT_FOUND", "Email OTP challenge was not found.");
  }
  if (outcome.kind === "EXPIRED") {
    throw new EmailOtpServiceError("CHALLENGE_EXPIRED", "Email OTP challenge has expired.");
  }
  if (outcome.kind === "LOCKED") {
    throw new EmailOtpServiceError("CHALLENGE_LOCKED", "Email OTP challenge is locked.");
  }
  if (outcome.kind === "INVALID") {
    throw new EmailOtpServiceError("INVALID_CODE", "Email OTP code is invalid.");
  }
  if (outcome.kind === "UNAVAILABLE") {
    throw new EmailOtpServiceError("CHALLENGE_UNAVAILABLE", "Email OTP challenge is unavailable.");
  }
  if (outcome.kind !== "VERIFIED") {
    throw new EmailOtpServiceError("CHALLENGE_UNAVAILABLE", "Email OTP challenge is unavailable.");
  }
  return {
    challengeId: outcome.challenge.id,
    normalizedEmail: outcome.challenge.normalizedEmail,
    purpose: outcome.challenge.purpose,
    accountEmailId: outcome.challenge.accountEmailId,
    userId: outcome.challenge.userId,
    verifiedAt: outcome.verifiedAt,
  };
}

export async function consumeVerifiedEmailOtpChallenge<T = void>(
  challengeId: string,
  options: {
    now?: Date;
    /** Runs in the same transaction as the one-time CONSUMED transition. */
    apply?: (
      tx: Prisma.TransactionClient,
      challenge: EmailOtpConsumptionContext,
    ) => Promise<T>;
  } = {},
): Promise<T | undefined> {
  const now = options.now ?? new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    await lockChallengeRow(tx, challengeId);
    const challenge = await tx.emailOtpChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return "NOT_FOUND" as const;
    if (challenge.status !== "VERIFIED") return "UNAVAILABLE" as const;
    if (challenge.expiresAt <= now) {
      await tx.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { status: "EXPIRED" },
      });
      return "EXPIRED" as const;
    }
    const verifiedAt = challenge.verifiedAt;
    if (!verifiedAt) return "UNAVAILABLE" as const;
    const result = options.apply
      ? await options.apply(tx, {
          challengeId: challenge.id,
          normalizedEmail: challenge.normalizedEmail,
          purpose: challenge.purpose,
          accountEmailId: challenge.accountEmailId,
          userId: challenge.userId,
          verifiedAt,
          expiresAt: challenge.expiresAt,
        })
      : undefined;
    await tx.emailOtpChallenge.update({
      where: { id: challenge.id },
      data: { status: "CONSUMED", consumedAt: now },
    });
    return { kind: "CONSUMED", result } as const;
  });

  if (outcome === "NOT_FOUND") {
    throw new EmailOtpServiceError("CHALLENGE_NOT_FOUND", "Email OTP challenge was not found.");
  }
  if (outcome === "EXPIRED") {
    throw new EmailOtpServiceError("CHALLENGE_EXPIRED", "Email OTP challenge has expired.");
  }
  if (outcome === "UNAVAILABLE") {
    throw new EmailOtpServiceError("CHALLENGE_UNAVAILABLE", "Email OTP challenge is unavailable.");
  }
  return outcome.result;
}
