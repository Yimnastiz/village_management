import type { Prisma } from "@prisma/client";
import { normalizeAccountEmail } from "@/lib/account-email";
import { headmanLoginEligibility, residentLoginEligibility, uniqueLoginUserId } from "@/lib/account-login-policy";
import { getConfiguredVillage } from "@/lib/configured-village";
import { prisma } from "@/lib/prisma";

type ResolverDb = Pick<Prisma.TransactionClient, "accountEmail" | "user">;

export type AccountLoginIdentity = {
  userId: string;
  accountKind: "RESIDENT_HOUSE" | "HEADMAN";
  villageId: string;
  email: string;
  normalizedEmail: string;
  accountEmailId: string | null;
  residentHouseAccountId: string | null;
  houseId: string | null;
  houseNumber: string | null;
};

export type AccountLoginResolution =
  | { kind: "RESOLVED"; identity: AccountLoginIdentity }
  | { kind: "NOT_FOUND" }
  | { kind: "AMBIGUOUS" };

export async function resolveLoginEmail(
  email: string,
  options: { db?: ResolverDb; configuredVillageId?: string } = {},
): Promise<AccountLoginResolution> {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 320) return { kind: "NOT_FOUND" };
  const db = options.db ?? prisma;
  const configuredVillageId = options.configuredVillageId ?? (await getConfiguredVillage()).id;
  const [alias, canonicalUsers] = await Promise.all([
    db.accountEmail.findUnique({
      where: { normalizedEmail },
      select: {
        id: true, email: true, normalizedEmail: true, status: true, verifiedAt: true, activatedAt: true, revokedAt: true,
        userId: true, residentHouseAccountId: true,
        user: { select: { id: true, accountKind: true, accountStatus: true, memberships: { where: { villageId: configuredVillageId, role: "RESIDENT" }, orderBy: { updatedAt: "desc" }, take: 1, select: { role: true, status: true, villageId: true, houseId: true } } } },
        residentHouseAccount: { select: { id: true, userId: true, villageId: true, houseId: true, activatedAt: true, suspendedAt: true, house: { select: { villageId: true, houseNumber: true } } } },
      },
    }),
    db.user.findMany({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, accountKind: true, accountStatus: true, memberships: { where: { villageId: configuredVillageId, role: "HEADMAN" }, orderBy: { updatedAt: "desc" }, take: 1, select: { role: true, status: true, villageId: true } } },
    }),
  ]);

  const uniqueUserId = uniqueLoginUserId([alias?.userId, ...canonicalUsers.map((user) => user.id)]);
  if (uniqueUserId === "AMBIGUOUS") return { kind: "AMBIGUOUS" };

  const account = alias?.residentHouseAccount;
  const residentUser = alias?.user;
  if (alias && account && residentUser) {
    const membership = residentUser.memberships[0] ?? null;
    if (residentLoginEligibility({
      accountEmailStatus: alias.status, accountEmailVerifiedAt: alias.verifiedAt, accountEmailActivatedAt: alias.activatedAt, accountEmailRevokedAt: alias.revokedAt,
      accountEmailUserId: alias.userId, accountEmailHouseAccountId: alias.residentHouseAccountId,
      houseAccountId: account.id, houseAccountUserId: account.userId, houseAccountVillageId: account.villageId, houseAccountHouseId: account.houseId,
      houseAccountActivatedAt: account.activatedAt, houseAccountSuspendedAt: account.suspendedAt, houseVillageId: account.house.villageId,
      configuredVillageId, userAccountKind: residentUser.accountKind, userAccountStatus: residentUser.accountStatus,
      membershipRole: membership?.role ?? null, membershipStatus: membership?.status ?? null, membershipVillageId: membership?.villageId ?? null, membershipHouseId: membership?.houseId ?? null,
    }) === "ELIGIBLE") {
      return { kind: "RESOLVED", identity: { userId: residentUser.id, accountKind: "RESIDENT_HOUSE", villageId: account.villageId, email: alias.email, normalizedEmail: alias.normalizedEmail, accountEmailId: alias.id, residentHouseAccountId: account.id, houseId: account.houseId, houseNumber: account.house.houseNumber } };
    }
  }

  const headman = canonicalUsers.find((user) => {
    const membership = user.memberships[0] ?? null;
    return headmanLoginEligibility({ accountKind: user.accountKind, accountStatus: user.accountStatus, membershipRole: membership?.role ?? null, membershipStatus: membership?.status ?? null, membershipVillageId: membership?.villageId ?? null, configuredVillageId }) === "ELIGIBLE";
  });
  if (headman?.email) {
    return { kind: "RESOLVED", identity: { userId: headman.id, accountKind: "HEADMAN", villageId: configuredVillageId, email: headman.email, normalizedEmail, accountEmailId: null, residentHouseAccountId: null, houseId: null, houseNumber: null } };
  }
  return { kind: "NOT_FOUND" };
}
