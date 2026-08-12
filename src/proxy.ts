import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAccessRedirectPath,
  getDuplicateNoticeSessionFromRequest,
  getResidentAreaAccessInfo,
  getSessionContextFromRequest,
  isAdminUser,
} from "@/lib/access-control";
import {
  readSuperAdminSession,
  SUPERADMIN_SESSION_COOKIE,
  superAdminSessionCookieOptions,
} from "@/lib/superadmin-auth";
import { AccountStatus } from "@prisma/client";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/superadmin/access") {
    const token = request.cookies.get(SUPERADMIN_SESSION_COOKIE)?.value;
    const superAdminSession = await readSuperAdminSession(token);
    if (superAdminSession) {
      return NextResponse.redirect(new URL("/superadmin/dashboard", request.url));
    }

    const response = NextResponse.next();
    if (token) {
      response.cookies.set(SUPERADMIN_SESSION_COOKIE, "", {
        ...superAdminSessionCookieOptions,
        maxAge: 0,
      });
    }
    return response;
  }
  const session = await getSessionContextFromRequest(request);
  const duplicateNoticeSession = session ? null : await getDuplicateNoticeSessionFromRequest(request);

  if (pathname === "/auth/account-duplicate") {
    if (duplicateNoticeSession) {
      return NextResponse.next();
    }
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    if (session.accountStatus !== AccountStatus.DUPLICATE_ID) {
      return NextResponse.redirect(new URL(await getAuthenticatedAccessRedirectPath(session), request.url));
    }
    return NextResponse.next();
  }

  if (duplicateNoticeSession || session?.accountStatus === AccountStatus.DUPLICATE_ID) {
    return NextResponse.redirect(new URL("/auth/account-duplicate", request.url));
  }

  if (pathname === "/auth/login" && session) {
    return NextResponse.redirect(new URL(await getAuthenticatedAccessRedirectPath(session), request.url));
  }

  if (pathname.startsWith("/resident")) {
    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const residentAccess = await getResidentAreaAccessInfo(session);
    if (!residentAccess.canAccess) {
      const isBindingRoute = pathname.startsWith("/resident/binding");
      const isUnboundSafeRoute =
        pathname === "/resident" ||
        pathname === "/resident/dashboard" ||
        pathname.startsWith("/resident/profile") ||
        pathname.startsWith("/resident/notifications") ||
        pathname.startsWith("/resident/news") ||
        pathname.startsWith("/resident/calendar") ||
        pathname.startsWith("/resident/downloads") ||
        pathname.startsWith("/resident/transparency") ||
        pathname.startsWith("/resident/gallery") ||
        pathname.startsWith("/resident/places") ||
        pathname.startsWith("/resident/contacts");
      if (!isBindingRoute && !isUnboundSafeRoute) {
        return NextResponse.redirect(new URL(residentAccess.redirectPath, request.url));
      }
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const redirectPath = await getAuthenticatedAccessRedirectPath(session);
    if (!isAdminUser(session)) {
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }

  if (pathname.startsWith("/superadmin")) {
    const superAdminSession = await readSuperAdminSession(request.cookies.get(SUPERADMIN_SESSION_COOKIE)?.value);
    if (!superAdminSession) return NextResponse.redirect(new URL("/superadmin/access", request.url));
  }

  if (pathname === "/auth/register" && session) {
    return NextResponse.redirect(new URL("/auth/landing", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/resident/:path*",
    "/admin/:path*",
    "/superadmin/:path*",
    "/auth/account-duplicate",
    "/auth/login",
    "/auth/register",
  ],
};
