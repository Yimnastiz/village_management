import { NextRequest, NextResponse } from "next/server";
import { createSuperAdminSession, isSuperAdminConfigured, superAdminSessionCookieOptions, verifySuperAdminAccessCode, SUPERADMIN_SESSION_COOKIE } from "@/lib/superadmin-auth";

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  if (!isSuperAdminConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const key = clientKey(request);
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.resetAt > now && record.count >= LIMIT) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const valid = await verifySuperAdminAccessCode(code);
  if (!valid) {
    const next = !record || record.resetAt <= now ? { count: 1, resetAt: now + WINDOW_MS } : { ...record, count: record.count + 1 };
    attempts.set(key, next);
    return NextResponse.json({ error: "INVALID" }, { status: 401 });
  }
  attempts.delete(key);
  const session = await createSuperAdminSession();
  if (!session) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SUPERADMIN_SESSION_COOKIE, session, superAdminSessionCookieOptions);
  return response;
}
