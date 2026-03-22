import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { MembershipStatus, SystemRole, VillageMembershipRole } from "@prisma/client";
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
  memberships: Array<{
    villageId: string;
    villageSlug: string | null;
    role: VillageMembershipRole;
    status: MembershipStatus;
  }>;
};

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
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

export async function getSessionContextByToken(token: string | null): Promise<SessionContext | null> {
  if (!token) {
    return null;
  }

  // Better Auth signs tokens with format: rawToken.signature
  // We need the raw token to query the database
  const unsignedToken = unsignSessionToken(token);

  const session = await prisma.authSession.findFirst({
    where: {
      token: unsignedToken,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
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
              role: true,
              status: true,
            },
          },
        },
      },
    },
  });

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
    await prisma.user.update({
      where: { id: session.user.id },
      data: { systemRole: SystemRole.SUPERADMIN },
    });
    session.user.systemRole = SystemRole.SUPERADMIN;
  }

  return {
    id: session.user.id,
    phoneNumber: session.user.phoneNumber,
    name: session.user.name,
    systemRole: session.user.systemRole,
    citizenVerifiedAt: session.user.citizenVerifiedAt,
    memberships: session.user.memberships.map((membership) => ({
      villageId: membership.villageId,
      villageSlug: membership.village?.slug ?? null,
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

  const headmanMembership = getHeadmanMembership(session);
  if (headmanMembership) {
    if (headmanMembership.villageSlug) {
      return `/admin/settings/village?village=${encodeURIComponent(
        headmanMembership.villageSlug
      )}`;
    }
    return `/admin/settings/village?villageId=${encodeURIComponent(
      headmanMembership.villageId
    )}`;
  }

  if (isAdminUser(session)) {
    return "/admin/dashboard";
  }

  // For residents, only redirect to dashboard if they're verified and active
  // Otherwise, send to binding page for account binding
  if (isResidentUser(session)) {
    const hasActiveResidentMembership = session.memberships.some(
      (membership) =>
        membership.role === VillageMembershipRole.RESIDENT &&
        membership.status === MembershipStatus.ACTIVE
    );
    
    if (session.citizenVerifiedAt && hasActiveResidentMembership) {
      return "/resident/dashboard";
    }
  }

  return "/auth/binding";
}
