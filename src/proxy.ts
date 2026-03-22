import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth-session_token",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = SESSION_COOKIE_NAMES
    .map((name) => request.cookies.get(name)?.value)
    .find(Boolean) ?? null;

  if (pathname.startsWith("/resident")) {
    if (!sessionToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!sessionToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/auth/register" && sessionToken) {
    return NextResponse.redirect(new URL("/auth/landing", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/resident/:path*",
    "/admin/:path*",
    "/auth/register",
  ],
};
