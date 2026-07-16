import { LoginOtpChallengeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  LOGIN_OTP_MAX_SENDS_PER_WINDOW,
  LOGIN_OTP_RESEND_COOLDOWN_MS,
  LOGIN_OTP_SEND_WINDOW_MS,
  LOGIN_OTP_TTL_MS,
  loadLoginChallenge,
  newLoginChallengeId,
  normalizeLoginPhone,
  publicLoginChallengeState,
  requestIpHash,
  retryAfterSeconds,
  setLoginChallengeCookie,
  withLoginPhoneLock,
} from "@/lib/login-otp-challenge";

export async function GET(request: NextRequest) {
  let challenge = await loadLoginChallenge(request);
  if (!challenge) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  for (let attempt = 0; challenge.status === LoginOtpChallengeStatus.PENDING_SEND && attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    challenge = await prisma.loginOtpChallenge.findUnique({ where: { id: challenge.id } });
    if (!challenge) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  }
  if (challenge.status === LoginOtpChallengeStatus.PENDING_SEND) {
    return NextResponse.json({ error: "OTP delivery is still in progress.", data: publicLoginChallengeState(challenge) }, { status: 202 });
  }
  return NextResponse.json({ ok: true, data: publicLoginChallengeState(challenge) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { phoneNumber?: string; intent?: "START_OR_RESUME" | "RESEND" } | null;
  const phoneNumber = normalizeLoginPhone(body?.phoneNumber ?? "");
  const intent = body?.intent === "RESEND" ? "RESEND" : "START_OR_RESUME";
  if (!phoneNumber) return NextResponse.json({ error: "Unable to send OTP." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { phoneNumber: { in: [phoneNumber, `+66${phoneNumber.slice(1)}`] } },
    select: { phoneNumber: true },
  });
  if (!user) return NextResponse.json({ error: "Unable to send OTP." }, { status: 400 });

  const now = new Date();
  const reservation = await withLoginPhoneLock(phoneNumber, async (tx) => {
    const existing = await tx.loginOtpChallenge.findUnique({ where: { phoneNumber } });
    const resumableStatuses: LoginOtpChallengeStatus[] = [
      LoginOtpChallengeStatus.PENDING_SEND,
      LoginOtpChallengeStatus.ACTIVE,
      LoginOtpChallengeStatus.VERIFYING,
      LoginOtpChallengeStatus.LOCKED,
    ];
    if (intent === "START_OR_RESUME" && existing && resumableStatuses.includes(existing.status)) {
      return { resumed: true as const, challenge: existing };
    }
    if (existing?.lockedUntil && existing.lockedUntil > now) {
      return { resumed: false as const, denied: true as const, reason: "lock", challenge: existing, retryAt: existing.lockedUntil };
    }
    if (existing?.resendAvailableAt && existing.resendAvailableAt > now) {
      return { resumed: false as const, denied: true as const, reason: "cooldown", challenge: existing, retryAt: existing.resendAvailableAt };
    }
    if (existing?.status === LoginOtpChallengeStatus.PENDING_SEND && now.getTime() - existing.updatedAt.getTime() < 30_000) {
      return { resumed: false as const, denied: true as const, reason: "in-flight", challenge: existing, retryAt: new Date(existing.updatedAt.getTime() + 30_000) };
    }

    const windowStartedAt = !existing || now.getTime() - existing.sendWindowStartedAt.getTime() >= LOGIN_OTP_SEND_WINDOW_MS
      ? now
      : existing.sendWindowStartedAt;
    const sendCount = windowStartedAt === now ? 0 : existing?.sendCount ?? 0;
    if (sendCount >= LOGIN_OTP_MAX_SENDS_PER_WINDOW) {
      return { resumed: false as const, denied: true as const, reason: "rate-limit", challenge: existing!, retryAt: new Date(windowStartedAt.getTime() + LOGIN_OTP_SEND_WINDOW_MS) };
    }

    const challengeToken = newLoginChallengeId();
    const challenge = await tx.loginOtpChallenge.upsert({
      where: { phoneNumber },
      create: {
        phoneNumber,
        otpIdentifier: user.phoneNumber,
        challengeToken,
        status: LoginOtpChallengeStatus.PENDING_SEND,
        sendWindowStartedAt: windowStartedAt,
        sendCount: sendCount + 1,
        ipHash: requestIpHash(request),
      },
      update: {
        otpIdentifier: user.phoneNumber,
        challengeToken,
        status: LoginOtpChallengeStatus.PENDING_SEND,
        sendWindowStartedAt: windowStartedAt,
        sendCount: sendCount + 1,
        ipHash: requestIpHash(request),
      },
    });
    await tx.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
    return { resumed: false as const, denied: false as const, challenge };
  });

  if (reservation.resumed) {
    const locked = Boolean(reservation.challenge.lockedUntil && reservation.challenge.lockedUntil > now);
    const response = NextResponse.json({
      ok: true,
      outcome: locked ? "LOCKED" : "RESUME_EXISTING_CHALLENGE",
      retryAfterSeconds: locked ? retryAfterSeconds(reservation.challenge.lockedUntil, now) : undefined,
      data: publicLoginChallengeState(reservation.challenge),
    });
    setLoginChallengeCookie(response, reservation.challenge.challengeToken);
    return response;
  }

  if (reservation.denied) {
    return NextResponse.json({
      error: reservation.reason === "lock" ? "OTP verification is temporarily locked." : "Please wait before requesting another OTP.",
      retryAfterSeconds: retryAfterSeconds(reservation.retryAt, now),
      data: publicLoginChallengeState(reservation.challenge),
    }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds(reservation.retryAt, now)) } });
  }

  try {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: user.phoneNumber } });
  } catch {
    await withLoginPhoneLock(phoneNumber, async (tx) => {
      await tx.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
      await tx.loginOtpChallenge.updateMany({
        where: { id: reservation.challenge.id, status: LoginOtpChallengeStatus.PENDING_SEND },
        data: { status: LoginOtpChallengeStatus.SEND_FAILED, otpSentAt: null, otpExpiresAt: null, resendAvailableAt: null },
      });
    });
    return NextResponse.json({ error: "OTP provider could not send the code." }, { status: 502 });
  }

  const sentAt = new Date();
  const challenge = await withLoginPhoneLock(phoneNumber, (tx) => tx.loginOtpChallenge.update({
    where: { id: reservation.challenge.id },
    data: {
      status: LoginOtpChallengeStatus.ACTIVE,
      otpSentAt: sentAt,
      otpExpiresAt: new Date(sentAt.getTime() + LOGIN_OTP_TTL_MS),
      resendAvailableAt: new Date(sentAt.getTime() + LOGIN_OTP_RESEND_COOLDOWN_MS),
      failedAttempts: 0,
      lockedUntil: null,
    },
  }));
  const response = NextResponse.json({ ok: true, outcome: "OTP_SENT", data: publicLoginChallengeState(challenge) });
  setLoginChallengeCookie(response, challenge.challengeToken);
  return response;
}
