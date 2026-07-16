import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.endsWith("/phone-number/send-otp") || pathname.endsWith("/phone-number/verify")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return handlers.POST(request);
}
