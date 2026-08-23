import { createHash, randomUUID } from "node:crypto";
import type { LoginOtpChallenge } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const LOGIN_OTP_COOKIE = "login_otp_challenge";
export const LOGIN_OTP_TTL_MS = 5 * 60 * 1000;
export const LOGIN_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const LOGIN_OTP_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_OTP_MAX_FAILED = 5;
export const LOGIN_OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_OTP_MAX_SENDS_PER_WINDOW = 5;
// A send or verification request that has not finished within this window is
// treated as interrupted. The per-phone advisory lock still prevents a second
// request from racing during the normal in-flight period.
export const LOGIN_OTP_IN_FLIGHT_MS = 30 * 1000;

export function normalizeLoginPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^66\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return "";
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

export function setLoginChallengeCookie(response: NextResponse, challengeToken: string) {
  response.cookies.set({
    name: LOGIN_OTP_COOKIE,
    value: challengeToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil((LOGIN_OTP_TTL_MS + LOGIN_OTP_LOCK_MS) / 1000),
  });
}

export async function withLoginPhoneLock<T>(phoneNumber: string, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`login-otp:${phoneNumber}`}))`;
    return operation(tx);
  });
}

export async function loadLoginChallenge(request: NextRequest) {
  const challengeToken = request.cookies.get(LOGIN_OTP_COOKIE)?.value;
  if (!challengeToken) return null;
  return prisma.loginOtpChallenge.findUnique({ where: { challengeToken } });
}

export function publicLoginChallengeState(challenge: LoginOtpChallenge) {
  return {
    otpSentAt: challenge.otpSentAt?.toISOString() ?? null,
    expiresAt: challenge.otpExpiresAt?.toISOString() ?? null,
    resendAvailableAt: challenge.resendAvailableAt?.toISOString() ?? null,
    otpLockedUntil: challenge.lockedUntil?.toISOString() ?? null,
    failedCount: challenge.failedAttempts,
    remainingAttempts: Math.max(0, LOGIN_OTP_MAX_FAILED - challenge.failedAttempts),
    status: challenge.status,
  };
}

export function retryAfterSeconds(until: Date | null, now = new Date()) {
  return until ? Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000)) : 0;
}
