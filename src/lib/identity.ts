import type { Prisma } from "@prisma/client";
import { AccountStatus, BindingRequestStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type IdentityDb = typeof prisma | Prisma.TransactionClient;

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function normalizeNationalId(value: string): string {
  return value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit))).replace(/\D/g, "");
}

export function isValidThaiNationalId(value: string): boolean {
  const digits = normalizeNationalId(value);
  if (!/^\d{13}$/.test(digits)) return false;
  const checksum = digits.slice(0, 12).split("").reduce((sum, digit, index) => sum + Number(digit) * (13 - index), 0);
  return (11 - (checksum % 11)) % 10 === Number(digits[12]);
}

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

export async function cleanupDuplicateUnboundUsersByNationalId(db: IdentityDb, nationalId: string, winnerUserId: string) {
  const normalized = normalizeNationalId(nationalId);
  const candidates = await db.person.findMany({
    where: { nationalId: normalized, userId: { not: null, notIn: [winnerUserId] } },
    select: { userId: true, user: { select: { memberships: { where: { status: MembershipStatus.ACTIVE, houseId: { not: null } }, select: { id: true } } } } },
  });
  const loserIds = candidates.filter((item) => item.userId && item.user?.memberships.length === 0).map((item) => item.userId!);
  if (!loserIds.length) return 0;
  await Promise.all([
    db.user.updateMany({ where: { id: { in: loserIds } }, data: { accountStatus: AccountStatus.DUPLICATE_ID } }),
    db.authSession.deleteMany({ where: { userId: { in: loserIds } } }),
    db.bindingRequest.updateMany({ where: { userId: { in: loserIds }, status: BindingRequestStatus.PENDING }, data: { status: BindingRequestStatus.REJECTED, reviewNote: "บัญชีนี้ใช้เลขบัตรประชาชนซ้ำกับบัญชีที่ได้รับการผูกบ้านแล้ว กรุณาสมัครใหม่ด้วยข้อมูลที่ถูกต้อง" } }),
    db.villageMembership.updateMany({ where: { userId: { in: loserIds }, status: { not: MembershipStatus.ACTIVE } }, data: { status: MembershipStatus.REJECTED, houseId: null } }),
  ]);
  return loserIds.length;
}
