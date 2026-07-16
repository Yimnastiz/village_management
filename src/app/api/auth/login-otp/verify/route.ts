import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  LOGIN_OTP_COOKIE,
  LOGIN_OTP_LOCK_MS,
  LOGIN_OTP_MAX_FAILED,
  loadLoginChallenge,
  publicLoginChallengeState,
  requestIpHash,
} from "@/lib/login-otp-challenge";

const activeVerifications = new Set<string>();

export async function POST(request: NextRequest) {
  const challenge = await loadLoginChallenge(request);
  if (!challenge) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  const now = new Date();
  const lockedUntil = challenge.state.lockedUntil ? new Date(challenge.state.lockedUntil) : null;
  if (lockedUntil && lockedUntil > now) {
    return NextResponse.json({ error: "OTP verification is temporarily locked.", data: publicLoginChallengeState(challenge.state, challenge.record.expiresAt) }, { status: 423 });
  }
  if (challenge.record.expiresAt <= now) {
    return NextResponse.json({ error: "OTP has expired. Please request a new code.", data: publicLoginChallengeState(challenge.state, challenge.record.expiresAt) }, { status: 410 });
  }
  if (challenge.state.ipHash !== requestIpHash(request)) {
    return NextResponse.json({ error: "Unable to verify OTP." }, { status: 403 });
  }
  if (activeVerifications.has(challenge.challengeId)) {
    return NextResponse.json({ error: "OTP verification is already in progress." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Invalid OTP payload." }, { status: 400 });

  activeVerifications.add(challenge.challengeId);
  try {
    const result = await auth.api.verifyPhoneNumber({
      body: { phoneNumber: challenge.state.phoneNumber, code },
      headers: request.headers,
      returnHeaders: true,
    });

    await prisma.authVerification.delete({ where: { id: challenge.record.id } }).catch(() => undefined);
    const response = NextResponse.json({ ok: true });
    const setCookie = result.headers.getSetCookie();
    for (const cookie of setCookie) response.headers.append("set-cookie", cookie);
    response.cookies.delete(LOGIN_OTP_COOKIE);
    return response;
  } catch {
    const failedCount = challenge.state.failedCount + 1;
    const nextState = {
      ...challenge.state,
      failedCount,
      lockedUntil: failedCount >= LOGIN_OTP_MAX_FAILED
        ? new Date(now.getTime() + LOGIN_OTP_LOCK_MS).toISOString()
        : null,
    };
    const persistenceExpiry = nextState.lockedUntil ? new Date(nextState.lockedUntil) : challenge.record.expiresAt;
    await prisma.authVerification.update({
      where: { id: challenge.record.id },
      data: { value: JSON.stringify(nextState), expiresAt: persistenceExpiry },
    });
    const data = publicLoginChallengeState(nextState, challenge.record.expiresAt);
    if (nextState.lockedUntil) return NextResponse.json({ error: "กรอก OTP ผิดครบ 5 ครั้ง ระบบถูกล็อกชั่วคราว 15 นาที", data }, { status: 423 });
    return NextResponse.json({ error: `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${LOGIN_OTP_MAX_FAILED - failedCount} ครั้ง`, data }, { status: 401 });
  } finally {
    activeVerifications.delete(challenge.challengeId);
  }
}
