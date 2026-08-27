import type { NextRequest } from "next/server";
import { AccountStatus, MembershipStatus, Prisma, SystemRole, VillageMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTokenLogMetadata, readSessionCookieFromRequest, readSessionCookieFromServer } from "@/lib/session-cookie";

export const ADMIN_MEMBERSHIP_ROLES = [
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
] as const;

const ADMIN_MEMBERSHIP_ROLE_SET = new Set<VillageMembershipRole>(ADMIN_MEMBERSHIP_ROLES);

export type SessionContext = {
  id: string;
  phoneNumber: string;
  name: string;
  accountStatus: AccountStatus;
  systemRole: SystemRole;
  citizenVerifiedAt: Date | null;
  activeVillageId: string | null;
  memberships: Array<{
    villageId: string;
    villageSlug: string | null;
    houseId: string | null;
    role: VillageMembershipRole;
    status: MembershipStatus;
  }>;
};

export type DuplicateNoticeSession = {
  id: string;
  accountStatus: AccountStatus;
};

export type DuplicateAccountRoutingState =
  | { kind: "NO_SESSION" }
  | { kind: "STALE_SESSION" }
  | { kind: "ACTIVE_SESSION"; session: SessionContext }
  | { kind: "DUPLICATE_NOTICE_PENDING"; id: string }
  | { kind: "DUPLICATE_NOTICE_SEEN"; id: string }
  | { kind: "RESTRICTED_SESSION" };

/**
 * Better Auth signs session tokens with HMAC-SHA256.
 * Signed format: rawToken.signature
 * This function extracts the raw token if it's signed.
 */
function unsignSessionToken(signedToken: string): string {
  if (!signedToken.includes(".")) {
    // Not signed, return as-is
    return signedToken;
  }

  const [rawToken] = signedToken.split(".");
  return rawToken;
}


const authSessionInclude = {
  user: {
    include: {
      memberships: {
        where: {
          status: MembershipStatus.ACTIVE,
        },
        select: {
          villageId: true,
          village: {
            select: {
              slug: true,
            },
          },
          houseId: true,
          role: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.AuthSessionInclude;

type AuthSessionWithUser = Prisma.AuthSessionGetPayload<{
  include: typeof authSessionInclude;
}>;

async function loadAuthSession(unsignedToken: string): Promise<AuthSessionWithUser | null> {
  return prisma.authSession.findFirst({
    where: {
      token: unsignedToken,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: authSessionInclude,
  });
}

export async function getSessionContextByToken(token: string | null): Promise<SessionContext | null> {
  if (!token) {
    return null;
  }

  // Better Auth signs tokens with format: rawToken.signature
  // We need the raw token to query the database
  const unsignedToken = unsignSessionToken(token);

  let session: AuthSessionWithUser | null = null;

  try {
    session = await loadAuthSession(unsignedToken);

  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[access-control] failed to load session context:",
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        getTokenLogMetadata(token)
      );
    }

    return null;
  }

  if (!session) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[access-control] session not found",
        getTokenLogMetadata(token)
      );
    }
    return null;
  }
  if (session.user.accountStatus !== AccountStatus.ACTIVE) return null;

  return {
    id: session.user.id,
    phoneNumber: session.user.phoneNumber,
    name: session.user.name,
    accountStatus: session.user.accountStatus,
    systemRole: session.user.systemRole,
    citizenVerifiedAt: session.user.citizenVerifiedAt,
    activeVillageId: session.activeVillageId ?? null,
    memberships: session.user.memberships.map((membership) => ({
      villageId: membership.villageId,
      villageSlug: membership.village?.slug ?? null,
      houseId: membership.houseId,
      role: membership.role,
      status: membership.status,
    })),
  };
}

export async function getSessionContextFromServerCookies(): Promise<SessionContext | null> {
  const token = await readSessionCookieFromServer();
  return getSessionContextByToken(token);
}

export async function getSessionContextFromRequest(
  request: NextRequest | Request
): Promise<SessionContext | null> {
  return getSessionContextByToken(readSessionCookieFromRequest(request));
}

/**
 * The single routing decision for a session that may belong to a duplicate-ID
 * account.  Keep "duplicate account", "notice pending", and "notice seen"
 * separate so the proxy, pages, and API flows cannot disagree about redirects.
 */
export async function getDuplicateAccountRoutingStateByToken(
  token: string | null
): Promise<DuplicateAccountRoutingState> {
  if (!token) return { kind: "NO_SESSION" };

  const session = await loadAuthSession(unsignSessionToken(token)).catch(() => null);
  if (!session) return { kind: "STALE_SESSION" };

  if (session.user.accountStatus === AccountStatus.DUPLICATE_ID) {
    return session.user.duplicateNoticeSeenAt
      ? { kind: "DUPLICATE_NOTICE_SEEN", id: session.user.id }
      : { kind: "DUPLICATE_NOTICE_PENDING", id: session.user.id };
  }

  if (session.user.accountStatus !== AccountStatus.ACTIVE) {
    return { kind: "RESTRICTED_SESSION" };
  }

  return {
    kind: "ACTIVE_SESSION",
    session: {
      id: session.user.id,
      phoneNumber: session.user.phoneNumber,
      name: session.user.name,
      accountStatus: session.user.accountStatus,
      systemRole: session.user.systemRole,
      citizenVerifiedAt: session.user.citizenVerifiedAt,
      activeVillageId: session.activeVillageId ?? null,
      memberships: session.user.memberships.map((membership) => ({
        villageId: membership.villageId,
        villageSlug: membership.village?.slug ?? null,
        houseId: membership.houseId,
        role: membership.role,
        status: membership.status,
      })),
    },
  };
}

export async function getDuplicateAccountRoutingStateFromServerCookies(): Promise<DuplicateAccountRoutingState> {
  return getDuplicateAccountRoutingStateByToken(await readSessionCookieFromServer());
}

export async function getDuplicateAccountRoutingStateFromRequest(
  request: NextRequest | Request
): Promise<DuplicateAccountRoutingState> {
  return getDuplicateAccountRoutingStateByToken(readSessionCookieFromRequest(request));
}

export async function getDuplicateNoticeSessionByToken(token: string | null): Promise<DuplicateNoticeSession | null> {
  const state = await getDuplicateAccountRoutingStateByToken(token);
  return state.kind === "DUPLICATE_NOTICE_PENDING"
    ? { id: state.id, accountStatus: AccountStatus.DUPLICATE_ID }
    : null;
}

export async function getDuplicateNoticeSessionFromServerCookies(): Promise<DuplicateNoticeSession | null> {
  return getDuplicateNoticeSessionByToken(await readSessionCookieFromServer());
}

export async function getDuplicateNoticeSessionFromRequest(
  request: NextRequest | Request
): Promise<DuplicateNoticeSession | null> {
  return getDuplicateNoticeSessionByToken(readSessionCookieFromRequest(request));
}

export async function getActiveAuthRedirectPathFromServerCookies(): Promise<string | null> {
  const session = await getSessionContextFromServerCookies();
  if (session) return getAuthenticatedAccessRedirectPath(session);

  const duplicateSession = await getDuplicateNoticeSessionFromServerCookies();
  if (duplicateSession) return "/auth/account-duplicate";

  return null;
}

export async function getActiveAuthRedirectPathFromRequest(
  request: NextRequest | Request
): Promise<string | null> {
  const session = await getSessionContextFromRequest(request);
  if (session) return getAuthenticatedAccessRedirectPath(session);

  const duplicateSession = await getDuplicateNoticeSessionFromRequest(request);
  if (duplicateSession) return "/auth/account-duplicate";

  return null;
}

export function isAdminUser(session: SessionContext): boolean {
  return session.systemRole !== SystemRole.SUPERADMIN && session.memberships.some(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLE_SET.has(membership.role)
  );
}

export function canManagePopulation(role: VillageMembershipRole): boolean {
  return ADMIN_MEMBERSHIP_ROLE_SET.has(role);
}

export function canReviewBinding(role: VillageMembershipRole): boolean {
  return role === VillageMembershipRole.HEADMAN || role === VillageMembershipRole.ASSISTANT_HEADMAN;
}

export function isSuperAdminUser(session: SessionContext): boolean {
  // SUPERADMIN is retained in the database enum only for migration compatibility.
  // Browser-authenticated users never receive SuperAdmin access.
  void session;
  return false;
}

export function isResidentUser(session: SessionContext): boolean {
  return session.memberships.some(hasCompletedResidentBinding);
}

/** A resident binding is complete only after an active resident membership has a house. */
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
  options: {
    villageId?: string | null;
    roles?: readonly VillageMembershipRole[];
  } = {}
) {
  if (session.systemRole === SystemRole.SUPERADMIN) return null;

  const allowedRoles = new Set<VillageMembershipRole>(options.roles ?? ADMIN_MEMBERSHIP_ROLES);
  const targetVillageId = options.villageId ?? session.activeVillageId;
  const eligible = session.memberships.filter(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      allowedRoles.has(membership.role) &&
      (!targetVillageId || membership.villageId === targetVillageId)
  );

  return eligible[0] ?? null;
}

export function getResidentMembership(session: SessionContext) {
  const residentMemberships = session.memberships.filter(hasCompletedResidentBinding);

  if (residentMemberships.length === 0) {
    return null;
  }

  if (session.activeVillageId) {
    const activeMembership = residentMemberships.find(
      (membership) => membership.villageId === session.activeVillageId
    );

    if (activeMembership) {
      return activeMembership;
    }
  }

  return residentMemberships[0] ?? null;
}

export async function getResidentVillageAccess(session: SessionContext) {
  const membership = getResidentMembership(session);
  if (membership) {
    return { villageId: membership.villageId, hasResidentAccess: true } as const;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { registrationVillageId: true },
  });
  return user?.registrationVillageId
    ? { villageId: user.registrationVillageId, hasResidentAccess: false } as const
    : null;
}

export async function setActiveVillageForCurrentSession(villageId: string): Promise<boolean> {
  const token = await readSessionCookieFromServer();

  if (!token) {
    return false;
  }

  const unsignedToken = unsignSessionToken(token);
  const session = await loadAuthSession(unsignedToken);

  if (!session) {
    return false;
  }

  const canAccessVillage = session.user.memberships.some(
    (membership) => membership.status === MembershipStatus.ACTIVE && membership.villageId === villageId
  );

  if (!canAccessVillage) {
    return false;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { activeVillageId: villageId },
  });

  return true;
}

export function getHeadmanMembership(session: SessionContext) {
  return getAdminMembership(session, { roles: [VillageMembershipRole.HEADMAN] });
}

export function computeLandingPath(session: SessionContext): string {
  if (session.accountStatus === AccountStatus.DUPLICATE_ID) {
    return "/auth/account-duplicate";
  }
  if (isAdminUser(session)) {
    return "/admin/dashboard";
  }

  if (getResidentMembership(session)) {
    return "/resident/dashboard";
  }

  return "/resident/dashboard";
}

export async function getAuthenticatedAccessRedirectPath(session: SessionContext): Promise<string> {
  if (session.accountStatus === AccountStatus.DUPLICATE_ID) {
    return "/auth/account-duplicate";
  }
  if (isAdminUser(session)) {
    return "/admin/dashboard";
  }

  const latestResidentMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      role: VillageMembershipRole.RESIDENT,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      houseId: true,
    },
  });

  if (latestResidentMembership) {
    if (latestResidentMembership.status === MembershipStatus.ACTIVE) {
      // An authenticated resident without a house can still use the dashboard
      // to see binding guidance and public services. Binding remains an
      // explicit action from that dashboard/menu, rather than a forced landing.
      return "/resident/dashboard";
    }

    if (latestResidentMembership.status === MembershipStatus.PENDING) {
      return "/resident/dashboard";
    }

    if (latestResidentMembership.status === MembershipStatus.SUSPENDED) {
      return "/resident/dashboard";
    }

    if (latestResidentMembership.status === MembershipStatus.REJECTED) {
      return "/resident/dashboard";
    }
  }

  const latestBindingRequest = await prisma.bindingRequest.findFirst({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
    },
  });

  if (latestBindingRequest?.status === "PENDING") {
    return "/resident/dashboard";
  }

  if (latestBindingRequest?.status === "REJECTED") {
    return "/resident/dashboard";
  }

  return "/resident/dashboard";
}

export async function getResidentAreaAccessInfo(session: SessionContext): Promise<{ canAccess: boolean; redirectPath: string }> {
  const latestResidentMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      role: VillageMembershipRole.RESIDENT,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      houseId: true,
    },
  });

  if (latestResidentMembership?.status === MembershipStatus.ACTIVE && latestResidentMembership.houseId) {
    return { canAccess: true, redirectPath: "/resident/dashboard" };
  }

  if (latestResidentMembership?.status === MembershipStatus.ACTIVE && !latestResidentMembership.houseId) {
    return { canAccess: false, redirectPath: "/resident/binding" };
  }

  if (latestResidentMembership?.status === MembershipStatus.PENDING) {
    return { canAccess: false, redirectPath: "/resident/binding/pending?membershipStatus=PENDING" };
  }

  if (latestResidentMembership?.status === MembershipStatus.SUSPENDED) {
    // A suspended resident binding has no private-village access. It may be a
    // move-out, so route to a fresh binding request rather than a pending page.
    return { canAccess: false, redirectPath: "/resident/binding" };
  }

  if (latestResidentMembership?.status === MembershipStatus.REJECTED) {
    return { canAccess: false, redirectPath: "/resident/binding/pending?membershipStatus=REJECTED" };
  }

  const latestBindingRequest = await prisma.bindingRequest.findFirst({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
    select: { status: true },
  });

  if (latestBindingRequest?.status === "PENDING") {
    return { canAccess: false, redirectPath: "/resident/binding/pending" };
  }

  if (latestBindingRequest?.status === "REJECTED") {
    return { canAccess: false, redirectPath: "/resident/binding/pending?bindingStatus=REJECTED" };
  }

  return { canAccess: false, redirectPath: "/resident/binding" };
}
