import type { AuditAction, Prisma } from "@prisma/client";
import { maskEmail } from "@/lib/account-email";
import { prisma } from "@/lib/prisma";
import type { SensitiveAction } from "@/lib/sensitive-action-policy";

type AuditDb = typeof prisma | Prisma.TransactionClient;

type AuditActorMetadataInput = {
  userId: string | null;
  actorAuthSessionId?: string | null;
  metadata?: Prisma.InputJsonObject;
};

/**
 * Resolves security attribution without changing the durable business actor.
 * AuditLog.userId remains the User/House Account identity; session email data is
 * investigation-only metadata and is deliberately masked.
 */
export async function buildAuditActorMetadata(
  db: AuditDb,
  input: AuditActorMetadataInput,
): Promise<Prisma.InputJsonObject | undefined> {
  const existing = input.metadata ?? {};
  if (!input.userId) return Object.keys(existing).length ? existing : undefined;

  const userSelect = {
    accountKind: true,
    email: true,
    residentHouseAccount: {
      select: {
        houseId: true,
        house: { select: { houseNumber: true } },
      },
    },
  } satisfies Prisma.UserSelect;

  const session = input.actorAuthSessionId
    ? await db.authSession.findFirst({
        where: { id: input.actorAuthSessionId, userId: input.userId },
        select: {
          loginAccountEmailId: true,
          loginAccountEmail: { select: { id: true, email: true } },
          user: { select: userSelect },
        },
      })
    : null;
  const user = session?.user ?? await db.user.findUnique({
    where: { id: input.userId },
    select: userSelect,
  });
  if (!user) return Object.keys(existing).length ? existing : undefined;

  if (user.accountKind === "RESIDENT_HOUSE") {
    const houseAccount = user.residentHouseAccount;
    return {
      ...existing,
      actorAccountKind: user.accountKind,
      ...(houseAccount ? {
        actorHouseId: houseAccount.houseId,
        actorHouseNumber: houseAccount.house.houseNumber,
      } : {}),
      ...(session?.loginAccountEmailId ? {
        loginAccountEmailId: session.loginAccountEmailId,
      } : {}),
      ...(session?.loginAccountEmail?.email ? {
        maskedLoginEmail: maskEmail(session.loginAccountEmail.email),
      } : {}),
    };
  }

  return {
    ...existing,
    actorAccountKind: user.accountKind,
    ...(input.actorAuthSessionId && user.accountKind === "HEADMAN" && user.email
      ? { maskedLoginEmail: maskEmail(user.email) }
      : {}),
  };
}

/** Append-only writer for meaningful village audit events. Never include secrets or raw form payloads. */
export async function writeVillageAuditLog(
  db: AuditDb,
  input: { villageId: string; userId: string | null; action: AuditAction; resource: string; resourceId?: string | null; actorAuthSessionId?: string | null; metadata?: Prisma.InputJsonObject },
) {
  const { actorAuthSessionId, ...data } = input;
  const metadata = await buildAuditActorMetadata(db, {
    userId: input.userId,
    actorAuthSessionId,
    metadata: input.metadata,
  });
  return db.auditLog.create({ data: { ...data, resourceId: input.resourceId ?? null, metadata } });
}

/** Adds consistent policy metadata while preserving the existing append-only AuditLog schema. */
export async function writeVillagePolicyAuditLog(
  db: AuditDb,
  input: {
    villageId: string;
    actorUserId: string | null;
    actorRole: string;
    action: AuditAction;
    policyAction: SensitiveAction;
    targetType: string;
    targetId?: string | null;
    reason?: string | null;
    actorAuthSessionId?: string | null;
    metadata?: Prisma.InputJsonObject;
  },
) {
  return writeVillageAuditLog(db, {
    villageId: input.villageId,
    userId: input.actorUserId,
    action: input.action,
    resource: input.targetType,
    resourceId: input.targetId,
    actorAuthSessionId: input.actorAuthSessionId,
    metadata: {
      actorRole: input.actorRole,
      policyAction: input.policyAction,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.metadata ?? {}),
    },
  });
}
