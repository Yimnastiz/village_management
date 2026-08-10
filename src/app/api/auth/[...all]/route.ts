import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LEGACY_SESSION_COOKIE_NAMES, readNamedSessionCookiesFromHeader } from "@/lib/session-cookie";
import { prisma } from "@/lib/prisma";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

function getRawSessionToken(token: string) {
  return token.split(".", 1)[0];
}

function expireLegacySessionCookies(response: Response) {
  for (const name of LEGACY_SESSION_COOKIE_NAMES) {
    const secure = name.startsWith("__Secure-") ? "; Secure" : "";
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
    );
  }
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.endsWith("/phone-number/send-otp") || pathname.endsWith("/phone-number/verify")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!pathname.endsWith("/sign-out")) {
    return handlers.POST(request);
  }

  // Better Auth owns current-session invalidation. These records/cookies are
  // only for safe migration from the legacy cookie name our access layer used.
  const legacyTokens = readNamedSessionCookiesFromHeader(
    request.headers.get("cookie"),
    LEGACY_SESSION_COOKIE_NAMES
  ).map(getRawSessionToken);

  try {
    if (legacyTokens.length > 0) {
      await prisma.authSession.deleteMany({ where: { token: { in: legacyTokens } } });
    }
  } catch {
    return NextResponse.json({ error: "Unable to sign out." }, { status: 500 });
  }

  const response = await handlers.POST(request);
  expireLegacySessionCookies(response);
  return response;
}
