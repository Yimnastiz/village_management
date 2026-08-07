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
      select: { phoneNumber: true },
    }),
  ]);
  const personUserIds = persons.flatMap((person) => person.userId ? [person.userId] : []);
  const phoneNumbers = [...new Set(registrations.map((registration) => registration.phoneNumber))];
  if (!personUserIds.length && !phoneNumbers.length) return null;
  return db.user.findFirst({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      accountStatus: AccountStatus.ACTIVE,
      memberships: {
        some: {
          status: MembershipStatus.ACTIVE,
          houseId: { not: null },
          ...(villageId ? { villageId } : {}),
        },
      },
      OR: [
        ...(personUserIds.length ? [{ id: { in: personUserIds } }] : []),
        ...(phoneNumbers.length ? [{ phoneNumber: { in: phoneNumbers } }] : []),
      ],
    },
    select: { id: true },
  });
}

/** Includes registrations that have not yet been linked to a Person record. */
export async function getNationalIdForUser(db: IdentityDb, userId: string, villageId?: string | null) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true, person: { select: { nationalId: true } } },
  });
  if (!user) return null;
  if (user.person?.nationalId) return normalizeNationalId(user.person.nationalId) || null;
  const registration = await db.registrationTemp.findFirst({
    where: { phoneNumber: user.phoneNumber, status: RegistrationTempStatus.VERIFIED, ...(villageId ? { villageId } : {}) },
    orderBy: { updatedAt: "desc" },
    select: { nationalId: true },
  });
  return registration?.nationalId ? normalizeNationalId(registration.nationalId) || null : null;
}

/**
 * Keeps the bound account and disables only accounts with the same identity that
 * still have no active house membership. Sessions are revoked so an already
 * signed-in duplicate cannot continue using resident/admin routes.
 */
export async function cleanupDuplicateUnboundUsersByNationalId(
  db: IdentityDb,
  nationalId: string,
  winnerUserId: string,
  options: { actorId: string; villageId?: string | null } = { actorId: winnerUserId }
) {
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return 0;

  // A new resident can have a verified registration before it has a Person row.
  // Merge both sources, then revoke only users without *any* active membership.
  const [registrations, persons] = await Promise.all([
    db.registrationTemp.findMany({
      where: { nationalId: normalized, status: RegistrationTempStatus.VERIFIED, ...(options.villageId ? { villageId: options.villageId } : {}) },
      select: { phoneNumber: true },
    }),
    db.person.findMany({
      where: { nationalId: normalized, userId: { not: null }, ...(options.villageId ? { villageId: options.villageId } : {}) },
      select: { userId: true },
    }),
  ]);
  const phoneNumbers = [...new Set(registrations.map((registration) => registration.phoneNumber))];
  const personUserIds = persons.flatMap((person) => person.userId ? [person.userId] : []);
  const [personCandidates, registrationCandidates] = await Promise.all([
    personUserIds.length
      ? db.user.findMany({
          where: { id: { in: personUserIds, not: winnerUserId }, accountStatus: AccountStatus.ACTIVE, systemRole: { not: SystemRole.SUPERADMIN } },
          select: { id: true, phoneNumber: true, memberships: { select: { status: true } } },
        })
      : [],
    phoneNumbers.length
      ? db.user.findMany({
          where: { phoneNumber: { in: phoneNumbers }, id: { not: winnerUserId }, accountStatus: AccountStatus.ACTIVE, systemRole: { not: SystemRole.SUPERADMIN } },
          select: { id: true, phoneNumber: true, memberships: { select: { status: true } } },
        })
      : [],
  ]);
  const loserIds = [...new Map(
    [...personCandidates, ...registrationCandidates]
      .filter((candidate) => candidate.memberships.every((membership) => membership.status !== MembershipStatus.ACTIVE))
      .map((candidate) => [candidate.id, candidate.id]),
  ).values()];
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
  const loserPhoneNumbers = [...new Set(
    [...personCandidates, ...registrationCandidates]
      .filter((candidate) => loserIds.includes(candidate.id))
      .map((candidate) => candidate.phoneNumber),
  )];

  const resolvedAt = new Date();
  await Promise.all([
    db.user.updateMany({
      where: { id: { in: loserIds } },
      data: {
        accountStatus: AccountStatus.DUPLICATE_ID,
        duplicateOfUserId: winnerUserId,
        duplicateResolvedAt: resolvedAt,
        duplicateReason: DUPLICATE_NATIONAL_ID_REASON_CODE,
        duplicateNoticeLoginUsedAt: null,
        duplicateNoticeSeenAt: null,
      },
    }),
    db.authSession.deleteMany({ where: { userId: { in: loserIds } } }),
    db.registrationTemp.updateMany({
      where: {
        phoneNumber: { in: loserPhoneNumbers }, nationalId: normalized,
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
  ]);

  return loserIds.length;
}
