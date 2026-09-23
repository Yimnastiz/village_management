import type { NextRequest } from "next/server";
import { AccountKind, AccountStatus, MembershipStatus, Prisma, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTokenLogMetadata, readSessionCookieFromRequest, readSessionCookieFromServer } from "@/lib/session-cookie";
import { isMaintenanceModeEnabled } from "@/lib/system-settings";
import { getConfiguredVillage } from "@/lib/configured-village";

export const ADMIN_MEMBERSHIP_ROLES = [VillageMembershipRole.HEADMAN] as const;
const ADMIN_MEMBERSHIP_ROLE_SET = new Set<VillageMembershipRole>(ADMIN_MEMBERSHIP_ROLES);

export type SessionContext = {
  authSessionId: string;
  id: string;
  phoneNumber: string | null;
  name: string;
  accountKind: AccountKind | null;
  accountStatus: AccountStatus;
  citizenVerifiedAt: Date | null;
  activeVillageId: string | null;
  loginAccountEmailId: string | null;
  residentHouseAccount?: {
    villageId: string;
    houseId: string;
    activatedAt: Date | null;
    suspendedAt: Date | null;
  } | null;
  memberships: Array<{
    villageId: string;
    villageSlug: string | null;
    houseId: string | null;
    role: VillageMembershipRole;
    status: MembershipStatus;
  }>;
};

type ActiveHeadmanMembership = SessionContext["memberships"][number] & { role: "HEADMAN" };

function unsignSessionToken(signedToken: string): string {
  return signedToken.includes(".") ? signedToken.split(".")[0] : signedToken;
}

const authSessionInclude = {
  user: {
    include: {
      memberships: {
        where: { status: MembershipStatus.ACTIVE },
        select: {
          villageId: true,
          village: { select: { slug: true } },
          houseId: true,
          role: true,
          status: true,
        },
      },
      residentHouseAccount: {
        select: { villageId: true, houseId: true, activatedAt: true, suspendedAt: true },
      },
    },
  },
} satisfies Prisma.AuthSessionInclude;

type AuthSessionWithUser = Prisma.AuthSessionGetPayload<{ include: typeof authSessionInclude }>;

async function loadAuthSession(unsignedToken: string): Promise<AuthSessionWithUser | null> {
  return prisma.authSession.findFirst({
    where: { token: unsignedToken, expiresAt: { gt: new Date() } },
    include: authSessionInclude,
  });
}

async function toConfiguredSessionContext(session: AuthSessionWithUser): Promise<SessionContext> {
  const configuredVillage = await getConfiguredVillage();
  return {
    authSessionId: session.id,
    id: session.user.id,
    phoneNumber: session.user.phoneNumber,
    name: session.user.name,
    accountKind: session.user.accountKind,
    accountStatus: session.user.accountStatus,
    citizenVerifiedAt: session.user.citizenVerifiedAt,
    activeVillageId: configuredVillage.id,
    loginAccountEmailId: session.loginAccountEmailId,
    residentHouseAccount: session.user.residentHouseAccount,
    memberships: session.user.memberships
      .filter((membership) => membership.villageId === configuredVillage.id)
      .map((membership) => ({
        villageId: membership.villageId,
        villageSlug: membership.village.slug,
        houseId: membership.houseId,
        role: membership.role,
        status: membership.status,
      })),
  };
}

export async function getSessionContextByToken(token: string | null): Promise<SessionContext | null> {
  if (!token) return null;
  let session: AuthSessionWithUser | null = null;
  try {
    session = await loadAuthSession(unsignSessionToken(token));
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[access-control] failed to load session context", { errorName: error instanceof Error ? error.name : "UnknownError" }, getTokenLogMetadata(token));
    }
    return null;
  }
  if (!session || session.user.accountStatus !== AccountStatus.ACTIVE) return null;
  return toConfiguredSessionContext(session);
}

export async function getSessionContextFromServerCookies(): Promise<SessionContext | null> {
  return getSessionContextByToken(await readSessionCookieFromServer());
}

export async function getSessionContextFromRequest(request: NextRequest | Request): Promise<SessionContext | null> {
  return getSessionContextByToken(readSessionCookieFromRequest(request));
}

export async function getActiveAuthRedirectPathFromServerCookies(): Promise<string | null> {
  const session = await getSessionContextFromServerCookies();
  return session ? getAuthenticatedAccessRedirectPath(session) : null;
}

export async function getActiveAuthRedirectPathFromRequest(request: NextRequest | Request): Promise<string | null> {
  const session = await getSessionContextFromRequest(request);
  return session ? getAuthenticatedAccessRedirectPath(session) : null;
}

export function isAdminUser(session: SessionContext): boolean {
  return session.accountKind === AccountKind.HEADMAN && session.memberships.some(
    (membership) => membership.status === MembershipStatus.ACTIVE && ADMIN_MEMBERSHIP_ROLE_SET.has(membership.role)
  );
}

export function canManagePopulation(role: VillageMembershipRole): boolean {
  return ADMIN_MEMBERSHIP_ROLE_SET.has(role);
}

/** Kept for historical-data tools only. The final runtime has no Binding review workflow. */
export function canReviewBinding(role: VillageMembershipRole): boolean {
  return role === VillageMembershipRole.HEADMAN;
}

export function hasCompletedResidentBinding(
  membership: Pick<SessionContext["memberships"][number], "role" | "status" | "houseId"> | null | undefined
): boolean {
  return Boolean(
    membership &&
    membership.role === VillageMembershipRole.RESIDENT &&
    membership.status === MembershipStatus.ACTIVE &&
    membership.houseId
  );
}

export function getAdminMembership(
  session: SessionContext,
  options: { villageId?: string | null } = {}
) {
  if (session.accountKind !== AccountKind.HEADMAN) return null;
  const targetVillageId = options.villageId ?? session.activeVillageId;
  return session.memberships.find(
    (membership): membership is ActiveHeadmanMembership =>
      membership.status === MembershipStatus.ACTIVE &&
      membership.role === VillageMembershipRole.HEADMAN &&
      (!targetVillageId || membership.villageId === targetVillageId)
  ) ?? null;
}

export function getResidentMembership(session: SessionContext) {
  const houseAccount = session.residentHouseAccount;
  if (
    session.accountKind !== AccountKind.RESIDENT_HOUSE ||
    !houseAccount?.activatedAt ||
    houseAccount.suspendedAt
  ) return null;

  return session.memberships.find(
    (membership) =>
      hasCompletedResidentBinding(membership) &&
      membership.villageId === houseAccount.villageId &&
      membership.houseId === houseAccount.houseId &&
      (!session.activeVillageId || membership.villageId === session.activeVillageId)
  ) ?? null;
}

export function isResidentUser(session: SessionContext): boolean {
  return Boolean(getResidentMembership(session));
}

export async function getResidentVillageAccess(session: SessionContext) {
  const membership = getResidentMembership(session);
  return membership ? { villageId: membership.villageId, hasResidentAccess: true } as const : null;
}

export async function setActiveVillageForCurrentSession(villageId: string): Promise<boolean> {
  const configuredVillage = await getConfiguredVillage();
  if (villageId !== configuredVillage.id) return false;
  const token = await readSessionCookieFromServer();
  if (!token) return false;
  const session = await loadAuthSession(unsignSessionToken(token));
  if (!session) return false;
  const canAccessVillage = session.user.memberships.some(
    (membership) => membership.status === MembershipStatus.ACTIVE && membership.villageId === configuredVillage.id
  );
  if (!canAccessVillage) return false;
  await prisma.authSession.update({ where: { id: session.id }, data: { activeVillageId: villageId } });
  return true;
}

export function getHeadmanMembership(session: SessionContext) {
  return getAdminMembership(session);
}

export function computeLandingPath(session: SessionContext): string {
  if (isAdminUser(session)) return "/admin/dashboard";
  if (getResidentMembership(session)) return "/resident/dashboard";
  return "/auth/account-migration-required";
}

export async function getAuthenticatedAccessRedirectPath(session: SessionContext): Promise<string> {
  if (isAdminUser(session)) {
    return (await isMaintenanceModeEnabled()) ? "/admin/settings/system" : "/admin/dashboard";
  }
  return getResidentMembership(session)
    ? "/resident/dashboard"
    : "/auth/account-migration-required";
}

export async function getResidentAreaAccessInfo(session: SessionContext): Promise<{ canAccess: boolean; redirectPath: string }> {
  return getResidentMembership(session)
    ? { canAccess: true, redirectPath: "/resident/dashboard" }
    : { canAccess: false, redirectPath: "/auth/account-migration-required" };
}
