import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditDb = typeof prisma | Prisma.TransactionClient;

/** Append-only writer for meaningful village audit events. Never include secrets or raw form payloads. */
export async function writeVillageAuditLog(
  db: AuditDb,
  input: { villageId: string; userId: string | null; action: AuditAction; resource: string; resourceId?: string | null; metadata?: Prisma.InputJsonValue },
) {
  return db.auditLog.create({ data: { ...input, resourceId: input.resourceId ?? null } });
}
