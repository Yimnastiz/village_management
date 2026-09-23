import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAccessRedirectPath,
  getResidentAreaAccessInfo,
  getLegacyAccountRedirectPathFromRequest,
  getSessionContextFromRequest,
  isAdminUser,
} from "@/lib/access-control";
import { isMaintenanceModeEnabled } from "@/lib/system-settings";
import { ADMIN_MAINTENANCE_PATH, isMaintenanceBlockedAdminPath, isMaintenanceBlockedMutation, isMaintenanceRecoveryApiPath } from "@/lib/maintenance-policy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // System Settings is the Headman's sole maintenance recovery path. Normal
  // operational requests are stopped before a Server Action can mutate data.
  const isOperationalApi = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && pathname !== "/api/system/public-feedback-availability";
  const maintenanceEnabled = await isMaintenanceModeEnabled();
  if (maintenanceEnabled && (isMaintenanceBlockedMutation(pathname) || (isOperationalApi && !isMaintenanceRecoveryApiPath(pathname)))) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return NextResponse.json({ error: "ระบบอยู่ระหว่างการปรับปรุง" }, { status: 503 });
    }
  }
  const session = await getSessionContextFromRequest(request);
  const legacyRedirectPath = session ? null : await getLegacyAccountRedirectPathFromRequest(request);
  if (legacyRedirectPath) return NextResponse.redirect(new URL(legacyRedirectPath, request.url));

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
      return NextResponse.redirect(new URL(residentAccess.redirectPath, request.url));
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
    if (maintenanceEnabled && isMaintenanceBlockedAdminPath(pathname)) {
      return NextResponse.redirect(new URL(ADMIN_MAINTENANCE_PATH, request.url));
    }
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
    "/auth/login",
    "/auth/register",
    "/api/:path*",
  ],
};
