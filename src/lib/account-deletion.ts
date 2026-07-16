import { createHash, randomBytes } from "node:crypto";
import { AccountStatus, AuditAction, BindingRequestStatus, MembershipStatus, RegistrationTempStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
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
    select: { systemRole: true, memberships: { where: { status: MembershipStatus.ACTIVE, role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] } }, select: { role: true } } },
  });
  if (!user) throw new Error("Account not found.");
  if (user.systemRole === SystemRole.SUPERADMIN) throw new Error("ต้องถอดสิทธิ์ Super Admin ก่อนปิดบัญชี");
  if (user.memberships.length > 0) throw new Error("ต้องถอดหรือโอนหน้าที่ผู้ดูแลหมู่บ้านก่อนปิดบัญชี");
}

export async function finalizeAccountDeletion(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.accountStatus !== AccountStatus.DELETION_PENDING || !user.scheduledDeletionAt || user.scheduledDeletionAt > new Date()) return false;
    const anonymousPhone = `deleted-${user.id}`;
    await tx.bindingRequest.updateMany({ where: { userId, status: BindingRequestStatus.PENDING }, data: { status: BindingRequestStatus.CANCELLED } });
    await tx.villageMembership.updateMany({ where: { userId }, data: { status: MembershipStatus.SUSPENDED, houseId: null } });
    await tx.authSession.deleteMany({ where: { userId } });
    await tx.registrationTemp.updateMany({ where: { phoneNumber: user.phoneNumber }, data: { status: RegistrationTempStatus.CANCELLED, nationalId: "", name: "ผู้ใช้ที่ปิดบัญชีแล้ว" } });
    await tx.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
    await tx.loginOtpChallenge.deleteMany({ where: { phoneNumber: user.phoneNumber } });
    await tx.registrationOtpChallenge.deleteMany({ where: { phoneNumber: user.phoneNumber } });
    await tx.accountDeletionChallenge.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        accountStatus: AccountStatus.ANONYMIZED, anonymizedAt: new Date(), name: "ผู้ใช้ที่ปิดบัญชีแล้ว",
        phoneNumber: anonymousPhone, phoneNumberVerified: false, email: null, image: null,
        registrationProvince: null, registrationDistrict: null, registrationSubdistrict: null,
        registrationVillageId: null, citizenVerifiedAt: null, deletionRecoveryHash: null,
      },
    });
    await tx.auditLog.create({ data: { userId, action: AuditAction.UPDATE, resource: "UserAccount", resourceId: userId, metadata: { status: AccountStatus.ANONYMIZED } } });
    return true;
  });
}

export async function finalizeDueAccountDeletions() {
  const due = await prisma.user.findMany({ where: { accountStatus: AccountStatus.DELETION_PENDING, scheduledDeletionAt: { lte: new Date() } }, select: { id: true } });
  const results = await Promise.all(due.map(({ id }) => finalizeAccountDeletion(id)));
  return results.filter(Boolean).length;
}
