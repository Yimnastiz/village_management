import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LEGACY_SESSION_COOKIE_NAMES } from "@/lib/session-cookie";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

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

  // Better Auth remains the only owner of current-session invalidation.
  const response = await handlers.POST(request);
  // Prevent an old compatibility cookie from reviving a migrated session.
  expireLegacySessionCookies(response);
  return response;
}
