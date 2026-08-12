import { NextResponse } from "next/server";
import { SUPERADMIN_SESSION_COOKIE, superAdminSessionCookieOptions } from "@/lib/superadmin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SUPERADMIN_SESSION_COOKIE, "", { ...superAdminSessionCookieOptions, maxAge: 0 });
  return response;
}
