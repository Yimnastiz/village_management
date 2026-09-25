import { createHash, randomBytes } from "node:crypto";
import { AccountStatus, AuditAction, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACCOUNT_DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_RECOVERY_COOKIE = "account_deletion_recovery";

export function hashRecoveryToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRecoveryToken() {
  return randomBytes(32).toString("base64url");
}

export async function assertSelfDeletionAllowed(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountKind: true, memberships: { where: { status: MembershipStatus.ACTIVE, role: VillageMembershipRole.HEADMAN }, select: { role: true } } },
  });
  if (!user) throw new Error("Account not found.");
  if (user.accountKind === "RESIDENT_HOUSE") throw new Error("การปิดบัญชีบ้านต้องดำเนินการผ่านผู้ใหญ่บ้าน");
  if (user.memberships.length > 0) throw new Error("ต้องถอดหรือโอนหน้าที่ผู้ดูแลหมู่บ้านก่อนปิดบัญชี");
}

export async function finalizeAccountDeletion(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { memberships: { select: { villageId: true, role: true } } } });
    if (!user || user.accountStatus !== AccountStatus.DELETION_PENDING || !user.scheduledDeletionAt || user.scheduledDeletionAt > new Date()) return false;
    const anonymousPhone = user.phoneNumber ? `deleted-${user.id}` : null;
    await tx.villageMembership.updateMany({ where: { userId }, data: { status: MembershipStatus.SUSPENDED, houseId: null } });
    await tx.authSession.deleteMany({ where: { userId } });
    if (user.phoneNumber) {
      await tx.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
      await tx.loginOtpChallenge.deleteMany({ where: { phoneNumber: user.phoneNumber } });
    }
    await tx.accountDeletionChallenge.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        accountStatus: AccountStatus.ANONYMIZED, anonymizedAt: new Date(), name: "ผู้ใช้ที่ปิดบัญชีแล้ว",
        phoneNumber: anonymousPhone, phoneNumberVerified: false, email: null, image: null,
        deletionRecoveryHash: null,
      },
    });
    await tx.auditLog.createMany({ data: (user.memberships.length ? user.memberships : [{ villageId: null, role: null }]).map((membership) => ({ userId, villageId: membership.villageId, action: AuditAction.UPDATE, resource: "UserAccount", resourceId: userId, metadata: { actorRole: membership.role, actionName: "ACCOUNT_ANONYMIZED", status: AccountStatus.ANONYMIZED } })) });
    return true;
  });
}

export async function finalizeDueAccountDeletions() {
  const due = await prisma.user.findMany({ where: { accountStatus: AccountStatus.DELETION_PENDING, scheduledDeletionAt: { lte: new Date() } }, select: { id: true } });
  const results = await Promise.all(due.map(({ id }) => finalizeAccountDeletion(id)));
  return results.filter(Boolean).length;
}
