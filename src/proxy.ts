import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAccessRedirectPath,
  getDuplicateAccountRoutingStateFromRequest,
  getResidentAreaAccessInfo,
  isAdminUser,
} from "@/lib/access-control";
import {
  readSuperAdminSession,
  SUPERADMIN_SESSION_COOKIE,
  superAdminSessionCookieOptions,
} from "@/lib/superadmin-auth";
import { expireSessionCookies } from "@/lib/session-cookie";

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
  const authState = await getDuplicateAccountRoutingStateFromRequest(request);
  const session = authState.kind === "ACTIVE_SESSION" ? authState.session : null;
  const clearAndContinue = () => {
    const response = NextResponse.next();
    expireSessionCookies(response);
    return response;
  };
  const clearAndRedirectToLogin = () => {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("reason", "account-disabled");
    const response = NextResponse.redirect(loginUrl);
    expireSessionCookies(response);
    return response;
  };

  if (pathname === "/auth/account-duplicate") {
    if (authState.kind === "DUPLICATE_NOTICE_PENDING") {
      return NextResponse.next();
    }
    if (authState.kind === "DUPLICATE_NOTICE_SEEN" || authState.kind === "RESTRICTED_SESSION") {
      return clearAndRedirectToLogin();
    }
    if (session) {
      return NextResponse.redirect(new URL(await getAuthenticatedAccessRedirectPath(session), request.url));
    }
    return authState.kind === "STALE_SESSION"
      ? clearAndRedirectToLogin()
      : NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (authState.kind === "DUPLICATE_NOTICE_PENDING") {
    return NextResponse.redirect(new URL("/auth/account-duplicate", request.url));
  }

  if (authState.kind === "DUPLICATE_NOTICE_SEEN" || authState.kind === "RESTRICTED_SESSION") {
    return pathname === "/auth/login" ? clearAndContinue() : clearAndRedirectToLogin();
  }

  if (authState.kind === "STALE_SESSION" && pathname === "/auth/login") {
    return clearAndContinue();
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
