import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { MembershipStatus, Prisma, SystemRole, VillageMembershipRole } from "@prisma/client";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth-session_token",
] as const;

// The preferred (canonical) cookie name we use when setting new cookies.
export const SESSION_COOKIE = SESSION_COOKIE_NAMES[0];

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

export type SessionContext = {
  id: string;
  phoneNumber: string;
  name: string;
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

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

function toPhoneCandidates(raw: string): string[] {
  const normalized = normalizePhoneNumber(raw);
  const candidates = new Set<string>();

  if (!normalized) {
    return [];
  }

  candidates.add(normalized);

  if (/^0\d{9}$/.test(normalized)) {
    candidates.add(`+66${normalized.slice(1)}`);
  }

  if (/^\+66\d{9}$/.test(normalized)) {
    candidates.add(`0${normalized.slice(3)}`);
  }

  return Array.from(candidates);
}

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


export function parseCookieTokenFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((segment) => segment.trim());
  for (const part of parts) {
    for (const cookieName of SESSION_COOKIE_NAMES) {
      if (part.startsWith(`${cookieName}=`)) {
        return decodeURIComponent(part.slice(`${cookieName}=`.length));
      }
    }
  }
  return null;
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

async function hydrateResidentMembershipFromImportedData(session: AuthSessionWithUser) {
  if (session.user.memberships.length > 0) {
    return;
  }

  try {
    const phoneCandidates = toPhoneCandidates(session.user.phoneNumber);
    if (phoneCandidates.length === 0) {
      return;
    }

    const [phoneSeed, person] = await Promise.all([
      prisma.phoneRoleSeed.findFirst({
        where: {
          phoneNumber: {
            in: phoneCandidates,
          },
        },
        select: {
          villageId: true,
          membershipRole: true,
          isCitizenVerified: true,
        },
      }),
      prisma.person.findFirst({
        where: {
          phone: {
            in: phoneCandidates,
          },
        },
        select: {
          villageId: true,
          houseId: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const resolvedVillageId =
      phoneSeed?.villageId ?? person?.villageId ?? session.user.registrationVillageId ?? null;

    if (!resolvedVillageId) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[hydration] no village found for phone:",
          session.user.phoneNumber,
          "phoneSeed?.villageId:",
          phoneSeed?.villageId,
          "person?.villageId:",
          person?.villageId,
          "registrationVillageId:",
          session.user.registrationVillageId
        );
      }
      return;
    }

    await prisma.villageMembership.upsert({
      where: {
        userId_villageId: {
          userId: session.user.id,
          villageId: resolvedVillageId,
        },
      },
      update: {
        role: phoneSeed?.membershipRole ?? VillageMembershipRole.RESIDENT,
        status: MembershipStatus.ACTIVE,
        houseId: person?.houseId ?? null,
        joinedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        villageId: resolvedVillageId,
        role: phoneSeed?.membershipRole ?? VillageMembershipRole.RESIDENT,
        status: MembershipStatus.ACTIVE,
        houseId: person?.houseId ?? null,
        joinedAt: new Date(),
      },
    });

    if (phoneSeed?.isCitizenVerified && !session.user.citizenVerifiedAt) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          citizenVerifiedAt: new Date(),
          registrationVillageId: session.user.registrationVillageId ?? resolvedVillageId,
        },
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[hydration] successfully created membership for user",
        session.user.phoneNumber,
        "in village",
        resolvedVillageId
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const details =
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientUnknownRequestError
          ? `${error.name}: ${error.message}`
          : String(error);

      console.error(
        "[hydration] failed to hydrate membership for phone",
        session.user.phoneNumber,
        "error:",
        details
      );
    }
    return;
  }
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

    if (session) {
      await hydrateResidentMembershipFromImportedData(session);
      session = await loadAuthSession(unsignedToken);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const details =
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientUnknownRequestError
          ? `${error.name}: ${error.message}`
          : String(error);

      console.error(
        "[access-control] failed to load session context:",
        details,
        "Signed:",
        token,
        "Unsigned:",
        unsignedToken
      );
    }

    return null;
  }

  if (!session) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[access-control] session not found - Signed:",
        token,
        "Unsigned:",
        unsignedToken
      );
    }
    return null;
  }

  const normalizedBootstrapPhone = process.env.DEV_BOOTSTRAP_PHONE
    ? normalizePhoneNumber(process.env.DEV_BOOTSTRAP_PHONE)
    : null;
  const normalizedSessionPhone = normalizePhoneNumber(session.user.phoneNumber);

  if (
    normalizedBootstrapPhone &&
    normalizedSessionPhone === normalizedBootstrapPhone &&
    session.user.systemRole !== SystemRole.SUPERADMIN
  ) {
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { systemRole: SystemRole.SUPERADMIN },
      });
      session.user.systemRole = SystemRole.SUPERADMIN;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[access-control] failed to auto-promote bootstrap user:", error);
      }
    }
  }

  return {
    id: session.user.id,
    phoneNumber: session.user.phoneNumber,
    name: session.user.name,
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
  const cookieStore = await cookies();
  const token = SESSION_COOKIE_NAMES
    .map((name) => cookieStore.get(name)?.value)
    .find(Boolean) ?? null;
  return getSessionContextByToken(token);
}

export async function getSessionContextFromRequest(
  request: NextRequest | Request
): Promise<SessionContext | null> {
  let token: string | null = null;

  if ("cookies" in request && request.cookies?.get) {
    token = request.cookies.get(SESSION_COOKIE)?.value ?? null;
  } else {
    token = parseCookieTokenFromHeader(request.headers.get("cookie"));
  }

  return getSessionContextByToken(token);
}

export function isAdminUser(session: SessionContext): boolean {
  if (session.systemRole === SystemRole.SUPERADMIN) {
    return true;
  }

  return session.memberships.some((membership) =>
    ADMIN_MEMBERSHIP_ROLES.has(membership.role)
  );
}

export function isResidentUser(session: SessionContext): boolean {
  return session.memberships.some(
    (membership) => membership.role === VillageMembershipRole.RESIDENT
  );
}

export function getResidentMembership(session: SessionContext) {
  const residentMemberships = session.memberships.filter(
    (membership) =>
      membership.role === VillageMembershipRole.RESIDENT &&
      membership.status === MembershipStatus.ACTIVE
  );

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

export async function setActiveVillageForCurrentSession(villageId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = SESSION_COOKIE_NAMES
    .map((name) => cookieStore.get(name)?.value)
    .find(Boolean) ?? null;

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
  return (
    session.memberships.find(
      (membership) => membership.role === VillageMembershipRole.HEADMAN
    ) ?? null
  );
}

export function computeLandingPath(session: SessionContext): string {
  if (session.systemRole === SystemRole.SUPERADMIN) {
    return "/dev";
  }

  if (isAdminUser(session)) {
    return "/admin/dashboard";
  }

  if (isResidentUser(session)) {
    return "/resident/dashboard";
  }

  return "/auth/binding";
}
