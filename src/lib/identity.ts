import type { Prisma } from "@prisma/client";
import { AccountStatus, AuditAction, BindingRequestStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNationalId } from "@/lib/thai-identity";

export { isValidThaiNationalId, normalizeNationalId } from "@/lib/thai-identity";

type IdentityDb = typeof prisma | Prisma.TransactionClient;

export const DUPLICATE_NATIONAL_ID_REASON =
  "บัญชีนี้ใช้เลขบัตรประชาชนซ้ำกับบัญชีที่ได้รับการผูกบ้านแล้ว กรุณาสมัครใหม่ด้วยข้อมูลที่ถูกต้อง หากคิดว่าเป็นความผิดพลาด กรุณาแจ้งผู้ใหญ่บ้านของหมู่บ้านที่ท่านลงทะเบียนไว้ เพื่อให้ผู้ใหญ่บ้านประสานงานกับ Super Admin";

export async function lockNationalIdClaim(db: IdentityDb, nationalId: string) {
  const normalized = normalizeNationalId(nationalId);
  if (normalized) await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`national-id-claim:${normalized}`}))`;
}

export async function findBoundIdentityByNationalId(db: IdentityDb, nationalId: string, excludeUserId?: string) {
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return null;
  return db.person.findFirst({
    where: {
      nationalId: normalized,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      user: { memberships: { some: { status: MembershipStatus.ACTIVE, houseId: { not: null } } } },
    },
    select: { id: true, userId: true },
  });
}

/**
 * Keeps the bound account and disables only accounts with the same identity that
 * still have no active house membership. Sessions are revoked so an already
 * signed-in duplicate cannot continue using resident/admin routes.
 */
export async function cleanupDuplicateUnboundUsersByNationalId(
  db: IdentityDb,
  nationalId: string,
  winnerUserId: string
) {
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return 0;

  const candidates = await db.person.findMany({
    where: { nationalId: normalized, userId: { not: null, notIn: [winnerUserId] } },
    select: {
      userId: true,
      user: {
        select: {
          memberships: {
            where: { status: MembershipStatus.ACTIVE, houseId: { not: null } },
            select: { id: true },
          },
        },
      },
    },
  });
  const loserIds = candidates
    .filter((candidate) => candidate.userId && candidate.user?.memberships.length === 0)
    .map((candidate) => candidate.userId!);
  if (!loserIds.length) return 0;

  const resolvedAt = new Date();
  await Promise.all([
    db.user.updateMany({
      where: { id: { in: loserIds } },
      data: {
        accountStatus: AccountStatus.DUPLICATE_ID,
        duplicateOfUserId: winnerUserId,
        duplicateResolvedAt: resolvedAt,
        duplicateReason: DUPLICATE_NATIONAL_ID_REASON,
        duplicateNoticeLoginUsedAt: null,
        duplicateNoticeSeenAt: null,
      },
    }),
    db.authSession.deleteMany({ where: { userId: { in: loserIds } } }),
    db.bindingRequest.updateMany({
      where: { userId: { in: loserIds }, status: BindingRequestStatus.PENDING },
      data: { status: BindingRequestStatus.REJECTED, reviewNote: DUPLICATE_NATIONAL_ID_REASON },
    }),
    db.villageMembership.updateMany({
      where: { userId: { in: loserIds }, status: { not: MembershipStatus.ACTIVE } },
      data: { status: MembershipStatus.REJECTED, houseId: null },
    }),
    db.auditLog.createMany({
      data: loserIds.map((userId) => ({
        userId,
        action: AuditAction.UPDATE,
        resource: "UserAccount",
        resourceId: userId,
        metadata: { event: "DUPLICATE_NATIONAL_ID_DEACTIVATED", duplicateOfUserId: winnerUserId },
      })),
    }),
  ]);

  return loserIds.length;
}
