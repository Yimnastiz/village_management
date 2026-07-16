import { LoginOtpChallengeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LOGIN_OTP_COOKIE,
  LOGIN_OTP_LOCK_MS,
  LOGIN_OTP_MAX_FAILED,
  loadLoginChallenge,
  publicLoginChallengeState,
  retryAfterSeconds,
  withLoginPhoneLock,
} from "@/lib/login-otp-challenge";

export async function POST(request: NextRequest) {
  const loaded = await loadLoginChallenge(request);
  if (!loaded) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Invalid OTP payload." }, { status: 400 });

  const now = new Date();
  const reservation = await withLoginPhoneLock(loaded.phoneNumber, async (tx) => {
    const challenge = await tx.loginOtpChallenge.findUnique({ where: { phoneNumber: loaded.phoneNumber } });
    if (!challenge || challenge.challengeToken !== loaded.challengeToken) return { allowed: false as const, status: 404, reason: "missing", challenge: null };
    if (challenge.lockedUntil && challenge.lockedUntil > now) return { allowed: false as const, status: 429, reason: "locked", challenge };
    if (challenge.status === LoginOtpChallengeStatus.VERIFYING && now.getTime() - challenge.updatedAt.getTime() < 30_000) {
      return { allowed: false as const, status: 409, reason: "in-flight", challenge };
    }
    if ((challenge.status !== LoginOtpChallengeStatus.ACTIVE && challenge.status !== LoginOtpChallengeStatus.VERIFYING) || !challenge.otpExpiresAt) {
      return { allowed: false as const, status: 410, reason: "inactive", challenge };
    }
    if (challenge.otpExpiresAt <= now) return { allowed: false as const, status: 410, reason: "expired", challenge };
    const reserved = await tx.loginOtpChallenge.update({
      where: { id: challenge.id },
      data: { status: LoginOtpChallengeStatus.VERIFYING },
    });
    return { allowed: true as const, challenge: reserved };
  });

  if (!reservation.allowed) {
    const retry = reservation.challenge?.lockedUntil ? retryAfterSeconds(reservation.challenge.lockedUntil, now) : undefined;
    const error = reservation.reason === "locked"
      ? "OTP verification is temporarily locked."
      : reservation.reason === "in-flight"
        ? "OTP verification is already in progress."
        : reservation.reason === "missing"
          ? "Login OTP challenge not found."
          : "OTP has expired. Please request a new code.";
    return NextResponse.json({
      error,
      retryAfterSeconds: retry,
      data: reservation.challenge ? publicLoginChallengeState(reservation.challenge) : undefined,
    }, { status: reservation.status, headers: retry ? { "Retry-After": String(retry) } : undefined });
  }

  try {
    const result = await auth.api.verifyPhoneNumber({
      body: { phoneNumber: reservation.challenge.otpIdentifier, code },
      headers: request.headers,
      returnHeaders: true,
    });
    await withLoginPhoneLock(loaded.phoneNumber, async (tx) => {
      await tx.loginOtpChallenge.update({
        where: { id: reservation.challenge.id },
        data: { status: LoginOtpChallengeStatus.CONSUMED, otpExpiresAt: null, resendAvailableAt: null },
      });
      await tx.authVerification.deleteMany({ where: { identifier: reservation.challenge.otpIdentifier } });
    });
    const response = NextResponse.json({ ok: true });
    for (const cookie of result.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
    response.cookies.delete(LOGIN_OTP_COOKIE);
    return response;
  } catch {
    const failedAt = new Date();
    const challenge = await withLoginPhoneLock(loaded.phoneNumber, async (tx) => {
      const current = await tx.loginOtpChallenge.findUniqueOrThrow({ where: { id: reservation.challenge.id } });
      const failedAttempts = Math.min(LOGIN_OTP_MAX_FAILED, current.failedAttempts + 1);
      const lockedUntil = failedAttempts >= LOGIN_OTP_MAX_FAILED
        ? new Date(failedAt.getTime() + LOGIN_OTP_LOCK_MS)
        : null;
      const updated = await tx.loginOtpChallenge.update({
        where: { id: current.id },
        data: {
          failedAttempts,
          lockedUntil,
          status: lockedUntil ? LoginOtpChallengeStatus.LOCKED : LoginOtpChallengeStatus.ACTIVE,
        },
      });
      if (lockedUntil) await tx.authVerification.deleteMany({ where: { identifier: current.otpIdentifier } });
      return updated;
    });
    const data = publicLoginChallengeState(challenge);
    if (challenge.lockedUntil) {
      const retry = retryAfterSeconds(challenge.lockedUntil, failedAt);
      return NextResponse.json({ error: "กรอก OTP ผิดครบ 5 ครั้ง ระบบถูกล็อกชั่วคราว 15 นาที", retryAfterSeconds: retry, data }, { status: 429, headers: { "Retry-After": String(retry) } });
    }
    return NextResponse.json({ error: `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${LOGIN_OTP_MAX_FAILED - challenge.failedAttempts} ครั้ง`, data }, { status: 401 });
  }
}
