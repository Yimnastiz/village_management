import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SensitiveAction } from "@/lib/sensitive-action-policy";

type AuditDb = typeof prisma | Prisma.TransactionClient;

/** Append-only writer for meaningful village audit events. Never include secrets or raw form payloads. */
export async function writeVillageAuditLog(
  db: AuditDb,
  input: { villageId: string; userId: string | null; action: AuditAction; resource: string; resourceId?: string | null; metadata?: Prisma.InputJsonValue },
) {
  return db.auditLog.create({ data: { ...input, resourceId: input.resourceId ?? null } });
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
    metadata?: Prisma.InputJsonObject;
  },
) {
  return writeVillageAuditLog(db, {
    villageId: input.villageId,
    userId: input.actorUserId,
    action: input.action,
    resource: input.targetType,
    resourceId: input.targetId,
    metadata: {
      actorRole: input.actorRole,
      policyAction: input.policyAction,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.metadata ?? {}),
    },
  });
}
