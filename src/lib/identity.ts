import type { Prisma } from "@prisma/client";
import { AccountStatus, AuditAction, BindingRequestStatus, MembershipStatus, RegistrationTempStatus, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNationalId } from "@/lib/thai-identity";
import { maskNationalId } from "@/lib/utils";

export { isValidThaiNationalId, normalizeNationalId } from "@/lib/thai-identity";

type IdentityDb = typeof prisma | Prisma.TransactionClient;

export const DUPLICATE_NATIONAL_ID_REASON =
  "บัญชีนี้ใช้เลขบัตรประชาชนซ้ำกับบัญชีที่ได้รับการผูกบ้านแล้ว กรุณาสมัครใหม่ด้วยข้อมูลที่ถูกต้อง หากคิดว่าเป็นความผิดพลาด กรุณาแจ้งผู้ใหญ่บ้านของหมู่บ้านที่ท่านลงทะเบียนไว้ เพื่อให้ผู้ใหญ่บ้านประสานงานกับ Super Admin";
export const DUPLICATE_NATIONAL_ID_REASON_CODE = "NATIONAL_ID_ALREADY_VERIFIED_BY_ANOTHER_ACCOUNT";

function archivedPhoneNumber(userId: string) {
  return `revoked:${userId}`;
}

export async function lockNationalIdClaim(db: IdentityDb, nationalId: string) {
  const normalized = normalizeNationalId(nationalId);
  if (normalized) await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`national-id-claim:${normalized}`}))`;
}

export async function findBoundIdentityByNationalId(
  db: IdentityDb,
  nationalId: string,
  excludeUserId?: string,
  villageId?: string | null,
) {
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return null;
  const [persons, registrations] = await Promise.all([
    db.person.findMany({
      where: { nationalId: normalized, userId: { not: null }, ...(villageId ? { villageId } : {}) },
      select: { userId: true },
    }),
    db.registrationTemp.findMany({
      where: { nationalId: normalized, status: RegistrationTempStatus.VERIFIED, ...(villageId ? { villageId } : {}) },
      select: { userId: true },
    }),
  ]);
  const personUserIds = persons.flatMap((person) => person.userId ? [person.userId] : []);
  const registrationUserIds = registrations.flatMap((registration) => registration.userId ? [registration.userId] : []);
  if (!personUserIds.length && !registrationUserIds.length) return null;
  return db.user.findFirst({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      accountStatus: AccountStatus.ACTIVE,
      OR: [
        ...(personUserIds.length ? [{ id: { in: personUserIds } }] : []),
        // RegistrationTemp is only a legacy fallback when a Person row does
        // not exist. A Person is the canonical identity once it has been made.
        ...(registrationUserIds.length ? [{ id: { in: registrationUserIds }, person: { is: null } }] : []),
      ],
      memberships: {
        some: {
          status: MembershipStatus.ACTIVE,
          houseId: { not: null },
          ...(villageId ? { villageId } : {}),
        },
      },
    },
    select: { id: true },
  });
}

/** Includes registrations that have not yet been linked to a Person record. */
export async function getNationalIdForUser(db: IdentityDb, userId: string, villageId?: string | null) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { person: { select: { nationalId: true } } },
  });
  if (!user) return null;
  if (user.person?.nationalId) return normalizeNationalId(user.person.nationalId) || null;
  const registration = await db.registrationTemp.findFirst({
    where: { userId, status: RegistrationTempStatus.VERIFIED, ...(villageId ? { villageId } : {}) },
    orderBy: { updatedAt: "desc" },
    select: { nationalId: true },
  });
  return registration?.nationalId ? normalizeNationalId(registration.nationalId) || null : null;
}

/**
 * Keeps the bound account and disables only accounts with the same identity that
 * still have no active membership. RegistrationTemp is considered only when it
 * has an explicit owner userId; phone numbers are reusable and are not identity
 * ownership. Their phone identity is archived so it can be reused for a new
 * registration.
 */
export async function cleanupDuplicateUnboundUsersByNationalId(
  db: IdentityDb,
  nationalId: string,
  winnerUserId: string,
  options: { actorId: string | null; villageId?: string | null } = { actorId: winnerUserId }
) {
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return 0;

  // Merge stable Person and RegistrationTemp ownership. Legacy registrations
  // without an owner are intentionally diagnostic-only: matching them by phone
  // can revoke an unrelated account after a number has been reassigned.
  const [registrations, persons] = await Promise.all([
    db.registrationTemp.findMany({
      where: { nationalId: normalized, status: RegistrationTempStatus.VERIFIED, ...(options.villageId ? { villageId: options.villageId } : {}) },
      select: { userId: true },
    }),
    db.person.findMany({
      where: { nationalId: normalized, userId: { not: null }, ...(options.villageId ? { villageId: options.villageId } : {}) },
      select: { userId: true },
    }),
  ]);
  const registrationUserIds = registrations.flatMap((registration) => registration.userId ? [registration.userId] : []);
  const personUserIds = persons.flatMap((person) => person.userId ? [person.userId] : []);
  const candidates = personUserIds.length || registrationUserIds.length
    ? await db.user.findMany({
        where: {
          id: { not: winnerUserId },
          accountStatus: AccountStatus.ACTIVE,
          systemRole: { not: SystemRole.SUPERADMIN },
          OR: [
            ...(personUserIds.length ? [{ id: { in: personUserIds } }] : []),
            ...(registrationUserIds.length ? [{ id: { in: registrationUserIds }, person: { is: null } }] : []),
          ],
        },
        select: { id: true, phoneNumber: true, memberships: { select: { status: true } } },
      })
    : [];
  const loserIds = candidates
    .filter((candidate) => candidate.memberships.every((membership) => membership.status !== MembershipStatus.ACTIVE))
    .map((candidate) => candidate.id);
  if (!loserIds.length) {
    await db.auditLog.create({
      data: {
        userId: options.actorId,
        villageId: options.villageId ?? null,
        action: AuditAction.APPROVE_RESIDENT_WITH_NATIONAL_ID,
        resource: "NationalIdClaim",
        resourceId: winnerUserId,
        metadata: { targetUserId: winnerUserId, maskedNationalId: maskNationalId(normalized), duplicateAccountCount: 0 },
      },
    });
    return 0;
  }
  const loserUsers = candidates.filter((candidate) => loserIds.includes(candidate.id));
  const loserPhoneNumbers = [...new Set(loserUsers.map((candidate) => candidate.phoneNumber))];

  const resolvedAt = new Date();
  await Promise.all([
    ...loserUsers.map((user) => db.user.update({
      where: { id: user.id },
      data: {
        phoneNumber: archivedPhoneNumber(user.id),
        phoneNumberVerified: false,
        accountStatus: AccountStatus.DUPLICATE_ID,
        duplicateOfUserId: winnerUserId,
        duplicateResolvedAt: resolvedAt,
        duplicateReason: DUPLICATE_NATIONAL_ID_REASON_CODE,
        duplicateNoticeLoginUsedAt: null,
        duplicateNoticeSeenAt: null,
      },
    })),
    db.loginOtpChallenge.deleteMany({ where: { phoneNumber: { in: loserPhoneNumbers } } }),
    db.registrationOtpChallenge.deleteMany({ where: { phoneNumber: { in: loserPhoneNumbers } } }),
    db.authVerification.deleteMany({ where: { identifier: { in: loserPhoneNumbers } } }),
    db.accountDeletionChallenge.deleteMany({ where: { userId: { in: loserIds } } }),
    db.person.updateMany({ where: { userId: { in: loserIds } }, data: { phone: null } }),
    db.registrationTemp.updateMany({
      where: {
        userId: { in: loserIds }, nationalId: normalized,
        status: { in: [RegistrationTempStatus.WAITING_OTP, RegistrationTempStatus.VERIFIED] },
        ...(options.villageId ? { villageId: options.villageId } : {}),
      },
      data: { status: RegistrationTempStatus.REJECTED, rejectReason: DUPLICATE_NATIONAL_ID_REASON, rejectedAt: resolvedAt },
    }),
    db.bindingRequest.updateMany({
      where: { userId: { in: loserIds }, status: BindingRequestStatus.PENDING },
      data: { status: BindingRequestStatus.REJECTED, reviewedBy: options.actorId, reviewedAt: resolvedAt, reviewNote: DUPLICATE_NATIONAL_ID_REASON },
    }),
    db.villageMembership.updateMany({
      where: { userId: { in: loserIds }, status: { not: MembershipStatus.ACTIVE } },
      data: { status: MembershipStatus.REJECTED, houseId: null },
    }),
    db.auditLog.create({
      data: {
        userId: options.actorId,
        villageId: options.villageId ?? null,
        action: AuditAction.APPROVE_RESIDENT_WITH_NATIONAL_ID,
        resource: "NationalIdClaim",
        resourceId: winnerUserId,
        metadata: { targetUserId: winnerUserId, maskedNationalId: maskNationalId(normalized), duplicateAccountCount: loserIds.length },
      },
    }),
    db.auditLog.createMany({
      data: loserIds.map((userId) => ({
        userId: options.actorId,
        villageId: options.villageId ?? null,
        action: AuditAction.REVOKE_DUPLICATE_NATIONAL_ID_ACCOUNT,
        resource: "UserAccount",
        resourceId: userId,
        metadata: { targetUserId: userId, duplicateOfUserId: winnerUserId, reason: DUPLICATE_NATIONAL_ID_REASON_CODE, maskedNationalId: maskNationalId(normalized) },
      })),
    }),
    db.auditLog.createMany({
      data: loserUsers.map((user) => ({
        userId: options.actorId,
        villageId: options.villageId ?? null,
        action: AuditAction.RELEASE_PHONE_FROM_REVOKED_ACCOUNT,
        resource: "UserPhoneIdentity",
        resourceId: user.id,
        metadata: {
          targetUserId: user.id,
          reason: DUPLICATE_NATIONAL_ID_REASON_CODE,
          maskedPhone: maskPhoneNumber(user.phoneNumber),
          maskedNationalId: maskNationalId(normalized),
          releasedAt: resolvedAt.toISOString(),
        },
      })),
    }),
  ]);

  return loserIds.length;
}

function maskPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `${digits.slice(0, 3)}****${digits.slice(-3)}` : "***";
}
