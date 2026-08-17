import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { expireSessionCookies } from "@/lib/session-cookie";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

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
  expireSessionCookies(response);
  return response;
}
