import { Prisma, type AccountEmail } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canReleaseOpeningRequestEmail,
  canReclaimAccountEmail,
  canTransitionAccountEmail,
  decideAccountEmailReservation,
  normalizeAccountEmail,
} from "@/lib/account-email";

export type AccountEmailServiceErrorCode =
  | "INVALID_EMAIL"
  | "OPENING_REQUEST_NOT_FOUND"
  | "OPENING_REQUEST_NOT_RESERVABLE"
  | "EMAIL_ALREADY_RESERVED"
  | "ACCOUNT_EMAIL_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "OPENING_REQUEST_NOT_RELEASABLE"
  | "ACCOUNT_OWNERSHIP_MISMATCH"
  | "LAST_ACTIVE_EMAIL"
  | "EMAIL_ALREADY_ACTIVE"
  | "MAX_ACTIVE_EMAILS";

export class AccountEmailServiceError extends Error {
  constructor(
    readonly code: AccountEmailServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountEmailServiceError";
  }
}

export function validateAccountEmail(email: string): { email: string; normalizedEmail: string } {
  const trimmedEmail = email.trim();
  const normalizedEmail = normalizeAccountEmail(trimmedEmail);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 320) {
    throw new AccountEmailServiceError("INVALID_EMAIL", "A valid email address is required.");
  }
  return { email: trimmedEmail, normalizedEmail };
}

export async function lockAccountEmailNamespace(
  tx: Prisma.TransactionClient,
  normalizedEmail: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-email:${normalizedEmail}`}))`;
}

export async function reserveEmailForOpeningRequest(input: {
  openingRequestId: string;
  email: string;
}): Promise<AccountEmail> {
  try {
    return await prisma.$transaction((tx) => reserveEmailForOpeningRequestInTransaction(tx, input));
  } catch (error) {
    if (error instanceof AccountEmailServiceError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AccountEmailServiceError(
        "EMAIL_ALREADY_RESERVED",
        "This normalized email is already owned or reserved.",
      );
    }
    throw error;
  }
}

export async function reserveEmailForOpeningRequestInTransaction(
  tx: Prisma.TransactionClient,
  input: { openingRequestId: string; email: string },
): Promise<AccountEmail> {
  const identity = validateAccountEmail(input.email);
  await lockAccountEmailNamespace(tx, identity.normalizedEmail);

  const openingRequest = await tx.houseAccountOpeningRequest.findUnique({
    where: { id: input.openingRequestId },
    select: { id: true, status: true },
  });
  if (!openingRequest) {
    throw new AccountEmailServiceError(
      "OPENING_REQUEST_NOT_FOUND",
      "House account opening request was not found.",
    );
  }

  const existing = await tx.accountEmail.findUnique({
    where: { normalizedEmail: identity.normalizedEmail },
    include: { openingRequest: { select: { status: true } } },
  });
  const decision = decideAccountEmailReservation({
    identity: existing,
    targetOpeningRequestId: openingRequest.id,
    previousOpeningRequestStatus: existing?.openingRequest?.status ?? null,
  });

  if (decision === "IDEMPOTENT") {
    if (
      openingRequest.status === "PENDING_EMAIL_VERIFICATION"
      || openingRequest.status === "PENDING_REVIEW"
    ) return existing!;
    throw new AccountEmailServiceError(
      "OPENING_REQUEST_NOT_RESERVABLE",
      "A terminal opening request cannot retain a live email reservation.",
    );
  }
  if (openingRequest.status !== "PENDING_EMAIL_VERIFICATION") {
    throw new AccountEmailServiceError(
      "OPENING_REQUEST_NOT_RESERVABLE",
      "Only an opening request awaiting email verification may reserve an email.",
    );
  }
  if (decision === "CONFLICT") {
    throw new AccountEmailServiceError(
      "EMAIL_ALREADY_RESERVED",
      "This normalized email is already owned or reserved.",
    );
  }

  const accountEmail = decision === "CREATE"
    ? await tx.accountEmail.create({
        data: {
          ...identity,
          source: "OPENING_REQUEST",
          openingRequestId: openingRequest.id,
        },
      })
    : await tx.accountEmail.update({
        where: { id: existing!.id },
        data: {
          ...identity,
          status: "PENDING_VERIFICATION",
          source: "OPENING_REQUEST",
          openingRequestId: openingRequest.id,
          userId: null,
          residentHouseAccountId: null,
          verifiedAt: null,
          activatedAt: null,
          revokedAt: null,
          createdByUserId: null,
        },
      });

  await tx.houseAccountOpeningRequest.update({
    where: { id: openingRequest.id },
    data: {
      emailSnapshot: identity.email,
      normalizedEmailSnapshot: identity.normalizedEmail,
    },
  });
  return accountEmail;
}

export async function markOpeningRequestEmailVerified(input: {
  openingRequestId: string;
  accountEmailId: string;
  verifiedAt?: Date;
}): Promise<AccountEmail> {
  return prisma.$transaction((tx) => markOpeningRequestEmailVerifiedInTransaction(tx, input));
}

export async function markOpeningRequestEmailVerifiedInTransaction(
  tx: Prisma.TransactionClient,
  input: { openingRequestId: string; accountEmailId: string; verifiedAt?: Date },
): Promise<AccountEmail> {
  const identity = await tx.accountEmail.findUnique({ where: { id: input.accountEmailId } });
  if (!identity || identity.openingRequestId !== input.openingRequestId) {
    throw new AccountEmailServiceError(
      "ACCOUNT_EMAIL_NOT_FOUND",
      "The reserved email does not belong to this opening request.",
    );
  }
  if (!canTransitionAccountEmail(identity.status, "VERIFIED_PENDING_REVIEW")) {
    throw new AccountEmailServiceError(
      "INVALID_STATE_TRANSITION",
      `Cannot verify an AccountEmail in ${identity.status} state.`,
    );
  }
  return tx.accountEmail.update({
    where: { id: identity.id },
    data: {
      status: "VERIFIED_PENDING_REVIEW",
      verifiedAt: input.verifiedAt ?? new Date(),
    },
  });
}

export async function activateAccountEmail(input: {
  accountEmailId: string;
  userId: string;
  residentHouseAccountId?: string | null;
  activatedAt?: Date;
  verifiedAt?: Date;
}): Promise<AccountEmail> {
  return prisma.$transaction((tx) => activateAccountEmailInTransaction(tx, input));
}

export async function activateAccountEmailInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    accountEmailId: string;
    userId: string;
    residentHouseAccountId?: string | null;
    activatedAt?: Date;
    verifiedAt?: Date;
  },
): Promise<AccountEmail> {
  const ownerLock = input.residentHouseAccountId
    ? `house:${input.residentHouseAccountId}`
    : `user:${input.userId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-email-owner:${ownerLock}`}))`;
  const identity = await tx.accountEmail.findUnique({ where: { id: input.accountEmailId } });
  if (!identity) {
    throw new AccountEmailServiceError("ACCOUNT_EMAIL_NOT_FOUND", "AccountEmail was not found.");
  }
  if (!canTransitionAccountEmail(identity.status, "ACTIVE")) {
    throw new AccountEmailServiceError(
      "INVALID_STATE_TRANSITION",
      `Cannot activate an AccountEmail in ${identity.status} state.`,
    );
  }
  if (input.residentHouseAccountId) {
    const houseAccount = await tx.residentHouseAccount.findUnique({
      where: { id: input.residentHouseAccountId },
      select: { userId: true },
    });
    if (!houseAccount || houseAccount.userId !== input.userId) {
      throw new AccountEmailServiceError(
        "ACCOUNT_OWNERSHIP_MISMATCH",
        "ResidentHouseAccount and User ownership do not match.",
      );
    }
  }
  const updated = await tx.accountEmail.updateMany({
    where: {
      id: identity.id,
      status: identity.status,
      userId: identity.userId,
      residentHouseAccountId: identity.residentHouseAccountId,
      openingRequestId: identity.openingRequestId,
    },
    data: {
      status: "ACTIVE",
      source: input.residentHouseAccountId ? "HOUSE_ACCOUNT" : identity.source,
      userId: input.userId,
      residentHouseAccountId: input.residentHouseAccountId ?? null,
      activatedAt: input.activatedAt ?? new Date(),
      verifiedAt: identity.verifiedAt ?? input.verifiedAt ?? new Date(),
      revokedAt: null,
    },
  });
  if (updated.count !== 1) {
    throw new AccountEmailServiceError("INVALID_STATE_TRANSITION", "AccountEmail changed during activation.");
  }
  return (await tx.accountEmail.findUnique({ where: { id: identity.id } }))!;
}

export async function lockAccountEmailOwnerNamespace(
  tx: Prisma.TransactionClient,
  residentHouseAccountId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-email-owner:house:${residentHouseAccountId}`}))`;
}

export async function reserveEmailForHouseAccountInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    residentHouseAccountId: string;
    email: string;
    maxActiveEmails: number;
  },
): Promise<{ accountEmail: AccountEmail; resumed: boolean }> {
  const value = validateAccountEmail(input.email);
  await lockAccountEmailNamespace(tx, value.normalizedEmail);
  await lockAccountEmailOwnerNamespace(tx, input.residentHouseAccountId);

  const houseAccount = await tx.residentHouseAccount.findUnique({
    where: { id: input.residentHouseAccountId },
    select: { userId: true },
  });
  if (!houseAccount || houseAccount.userId !== input.userId) {
    throw new AccountEmailServiceError("ACCOUNT_OWNERSHIP_MISMATCH", "House account ownership does not match.");
  }

  const existing = await tx.accountEmail.findUnique({
    where: { normalizedEmail: value.normalizedEmail },
  });
  if (
    existing?.status === "ACTIVE"
    && existing.userId === input.userId
    && existing.residentHouseAccountId === input.residentHouseAccountId
  ) {
    throw new AccountEmailServiceError("EMAIL_ALREADY_ACTIVE", "This email is already active on this House Account.");
  }
  const canonicalOwner = await tx.user.findFirst({
    where: { email: { equals: value.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (canonicalOwner && canonicalOwner.id !== input.userId) {
    throw new AccountEmailServiceError("EMAIL_ALREADY_RESERVED", "This email is unavailable.");
  }
  if (
    existing?.status === "PENDING_VERIFICATION"
    && existing.source === "HOUSE_ACCOUNT"
    && existing.userId === input.userId
    && existing.residentHouseAccountId === input.residentHouseAccountId
  ) {
    return { accountEmail: existing, resumed: true };
  }
  if (existing && !canReclaimAccountEmail(existing)) {
    throw new AccountEmailServiceError("EMAIL_ALREADY_RESERVED", "This email is unavailable.");
  }
  const activeCount = await tx.accountEmail.count({
    where: { residentHouseAccountId: input.residentHouseAccountId, status: "ACTIVE" },
  });
  if (activeCount >= input.maxActiveEmails) {
    throw new AccountEmailServiceError("MAX_ACTIVE_EMAILS", "The House Account email limit was reached.");
  }

  const accountEmail = existing
    ? await tx.accountEmail.update({
        where: { id: existing.id },
        data: {
          ...value,
          status: "PENDING_VERIFICATION",
          source: "HOUSE_ACCOUNT",
          userId: input.userId,
          residentHouseAccountId: input.residentHouseAccountId,
          openingRequestId: null,
          verifiedAt: null,
          activatedAt: null,
          revokedAt: null,
          createdByUserId: input.userId,
        },
      })
    : await tx.accountEmail.create({
        data: {
          ...value,
          status: "PENDING_VERIFICATION",
          source: "HOUSE_ACCOUNT",
          userId: input.userId,
          residentHouseAccountId: input.residentHouseAccountId,
          createdByUserId: input.userId,
        },
      });
  return { accountEmail, resumed: false };
}

export async function releasePendingHouseAccountEmailInTransaction(
  tx: Prisma.TransactionClient,
  input: { accountEmailId: string; userId: string; residentHouseAccountId: string; releasedAt?: Date },
): Promise<AccountEmail> {
  const identity = await tx.accountEmail.findUnique({ where: { id: input.accountEmailId } });
  if (
    !identity
    || identity.source !== "HOUSE_ACCOUNT"
    || identity.status !== "PENDING_VERIFICATION"
    || identity.userId !== input.userId
    || identity.residentHouseAccountId !== input.residentHouseAccountId
  ) {
    throw new AccountEmailServiceError("ACCOUNT_EMAIL_NOT_FOUND", "Pending House Account email was not found.");
  }
  await lockAccountEmailNamespace(tx, identity.normalizedEmail);
  const updated = await tx.accountEmail.updateMany({
    where: {
      id: identity.id,
      status: "PENDING_VERIFICATION",
      userId: input.userId,
      residentHouseAccountId: input.residentHouseAccountId,
      source: "HOUSE_ACCOUNT",
    },
    data: {
      status: "REVOKED",
      userId: null,
      residentHouseAccountId: null,
      revokedAt: input.releasedAt ?? new Date(),
    },
  });
  if (updated.count !== 1) {
    throw new AccountEmailServiceError("INVALID_STATE_TRANSITION", "Pending House Account email changed during release.");
  }
  return (await tx.accountEmail.findUnique({ where: { id: identity.id } }))!;
}

export async function revokeAccountEmail(input: {
  accountEmailId: string;
  revokedAt?: Date;
}): Promise<AccountEmail> {
  return prisma.$transaction(async (tx) => {
    const initialIdentity = await tx.accountEmail.findUnique({ where: { id: input.accountEmailId } });
    if (!initialIdentity) {
      throw new AccountEmailServiceError("ACCOUNT_EMAIL_NOT_FOUND", "AccountEmail was not found.");
    }
    const ownerLock = initialIdentity.residentHouseAccountId
      ? `house:${initialIdentity.residentHouseAccountId}`
      : initialIdentity.userId
        ? `user:${initialIdentity.userId}`
        : `email:${initialIdentity.normalizedEmail}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-email-owner:${ownerLock}`}))`;
    const identity = await tx.accountEmail.findUnique({ where: { id: input.accountEmailId } });
    if (!identity) {
      throw new AccountEmailServiceError("ACCOUNT_EMAIL_NOT_FOUND", "AccountEmail was not found.");
    }
    if (!canTransitionAccountEmail(identity.status, "REVOKED")) {
      throw new AccountEmailServiceError(
        "INVALID_STATE_TRANSITION",
        `Cannot revoke an AccountEmail in ${identity.status} state.`,
      );
    }
    if (identity.status === "ACTIVE" && (identity.userId || identity.residentHouseAccountId)) {
      const activeIdentityCount = await tx.accountEmail.count({
        where: {
          status: "ACTIVE",
          ...(identity.residentHouseAccountId
            ? { residentHouseAccountId: identity.residentHouseAccountId }
            : { userId: identity.userId! }),
        },
      });
      if (activeIdentityCount <= 1) {
        throw new AccountEmailServiceError(
          "LAST_ACTIVE_EMAIL",
          "The final active login email cannot be revoked.",
        );
      }
    }
    return tx.accountEmail.update({
      where: { id: identity.id },
      data: {
        status: "REVOKED",
        userId: null,
        residentHouseAccountId: null,
        revokedAt: input.revokedAt ?? new Date(),
      },
    });
  });
}

export async function releaseOpeningRequestEmail(
  openingRequestId: string,
  releasedAt = new Date(),
): Promise<AccountEmail> {
  return prisma.$transaction((tx) => releaseOpeningRequestEmailInTransaction(tx, openingRequestId, releasedAt));
}

export async function releaseOpeningRequestEmailInTransaction(
  tx: Prisma.TransactionClient,
  openingRequestId: string,
  releasedAt = new Date(),
): Promise<AccountEmail> {
  const openingRequest = await tx.houseAccountOpeningRequest.findUnique({
    where: { id: openingRequestId },
    include: { initialEmail: true },
  });
  if (!openingRequest) {
    throw new AccountEmailServiceError(
      "OPENING_REQUEST_NOT_FOUND",
      "House account opening request was not found.",
    );
  }
  if (openingRequest.initialEmail) {
    await lockAccountEmailNamespace(tx, openingRequest.initialEmail.normalizedEmail);
  }
  const currentOpeningRequest = await tx.houseAccountOpeningRequest.findUnique({
    where: { id: openingRequestId },
    include: { initialEmail: true },
  });
  if (!currentOpeningRequest) {
    throw new AccountEmailServiceError(
      "OPENING_REQUEST_NOT_FOUND",
      "House account opening request was not found.",
    );
  }
  if (!canReleaseOpeningRequestEmail(currentOpeningRequest.status)) {
    throw new AccountEmailServiceError(
      "OPENING_REQUEST_NOT_RELEASABLE",
      "The opening request is not in a terminal releasable state.",
    );
  }
  const identity = currentOpeningRequest.initialEmail;
  if (!identity) {
    throw new AccountEmailServiceError(
      "ACCOUNT_EMAIL_NOT_FOUND",
      "The opening request has no reserved AccountEmail.",
    );
  }
  if (identity.status === "REVOKED") return identity;
  if (!canTransitionAccountEmail(identity.status, "REVOKED")) {
    throw new AccountEmailServiceError(
      "INVALID_STATE_TRANSITION",
      `Cannot release an AccountEmail in ${identity.status} state.`,
    );
  }
  return tx.accountEmail.update({
    where: { id: identity.id },
    data: {
      status: "REVOKED",
      userId: null,
      residentHouseAccountId: null,
      revokedAt: releasedAt,
    },
  });
}
