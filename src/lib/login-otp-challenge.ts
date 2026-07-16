import { createHash, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const LOGIN_OTP_COOKIE = "login_otp_challenge";
export const LOGIN_OTP_TTL_MS = 5 * 60 * 1000;
export const LOGIN_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const LOGIN_OTP_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_OTP_MAX_FAILED = 5;

export type LoginOtpChallengeState = {
  phoneNumber: string;
  ipHash: string;
  sentAt: string;
  resendAvailableAt: string;
  otpExpiresAt: string;
  failedCount: number;
  lockedUntil: string | null;
};

export function normalizeLoginPhone(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function requestIpHash(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export function newLoginChallengeId() {
  return randomUUID();
}

export function setLoginChallengeCookie(response: NextResponse, challengeId: string) {
  response.cookies.set({
    name: LOGIN_OTP_COOKIE,
    value: challengeId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil((LOGIN_OTP_TTL_MS + LOGIN_OTP_LOCK_MS) / 1000),
  });
}

export async function loadLoginChallenge(request: NextRequest) {
  const challengeId = request.cookies.get(LOGIN_OTP_COOKIE)?.value;
  if (!challengeId) return null;
  const record = await prisma.authVerification.findFirst({
    where: { identifier: `login-otp:${challengeId}` },
    orderBy: { updatedAt: "desc" },
  });
  if (!record) return null;
  try {
    const state = JSON.parse(record.value) as LoginOtpChallengeState;
    if (!/^\d{10}$/.test(state.phoneNumber) || typeof state.failedCount !== "number") return null;
    return { record, state, challengeId };
  } catch {
    return null;
  }
}

export function publicLoginChallengeState(state: LoginOtpChallengeState, expiresAt: Date) {
  return {
    otpSentAt: state.sentAt,
    expiresAt: state.otpExpiresAt ?? expiresAt.toISOString(),
    resendAvailableAt: state.resendAvailableAt,
    otpLockedUntil: state.lockedUntil,
    failedCount: state.failedCount,
    remainingAttempts: Math.max(0, LOGIN_OTP_MAX_FAILED - state.failedCount),
  };
}
