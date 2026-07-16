import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  LOGIN_OTP_RESEND_COOLDOWN_MS,
  LOGIN_OTP_TTL_MS,
  loadLoginChallenge,
  newLoginChallengeId,
  normalizeLoginPhone,
  publicLoginChallengeState,
  requestIpHash,
  setLoginChallengeCookie,
  type LoginOtpChallengeState,
} from "@/lib/login-otp-challenge";

export async function GET(request: NextRequest) {
  const challenge = await loadLoginChallenge(request);
  if (!challenge) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data: publicLoginChallengeState(challenge.state, challenge.record.expiresAt) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { phoneNumber?: string } | null;
  const phoneNumber = normalizeLoginPhone(body?.phoneNumber ?? "");
  if (!/^\d{10}$/.test(phoneNumber)) return NextResponse.json({ error: "Unable to send OTP." }, { status: 400 });

  const existing = await loadLoginChallenge(request);
  const now = new Date();
  if (existing) {
    const lockedUntil = existing.state.lockedUntil ? new Date(existing.state.lockedUntil) : null;
    if (lockedUntil && lockedUntil > now) return NextResponse.json({ error: "OTP verification is temporarily locked.", data: publicLoginChallengeState(existing.state, existing.record.expiresAt) }, { status: 423 });
    const resendAt = new Date(existing.state.resendAvailableAt);
    if (resendAt > now) return NextResponse.json({ error: "Please wait before requesting another OTP.", data: publicLoginChallengeState(existing.state, existing.record.expiresAt) }, { status: 429 });
  }

  const candidates = [phoneNumber, phoneNumber.startsWith("0") ? `+66${phoneNumber.slice(1)}` : phoneNumber];
  const user = await prisma.user.findFirst({ where: { phoneNumber: { in: candidates } }, select: { phoneNumber: true } });
  if (!user) return NextResponse.json({ error: "Unable to send OTP." }, { status: 400 });

  await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
  const challengeId = existing?.challengeId ?? newLoginChallengeId();
  const expiresAt = new Date(now.getTime() + LOGIN_OTP_TTL_MS);
  const state: LoginOtpChallengeState = {
    phoneNumber,
    ipHash: requestIpHash(request),
    sentAt: now.toISOString(),
    resendAvailableAt: new Date(now.getTime() + LOGIN_OTP_RESEND_COOLDOWN_MS).toISOString(),
    otpExpiresAt: expiresAt.toISOString(),
    failedCount: 0,
    lockedUntil: null,
  };

  if (existing) {
    await prisma.authVerification.update({ where: { id: existing.record.id }, data: { value: JSON.stringify(state), expiresAt } });
  } else {
    await prisma.authVerification.create({ data: { identifier: `login-otp:${challengeId}`, value: JSON.stringify(state), expiresAt } });
  }
  const response = NextResponse.json({ ok: true, data: publicLoginChallengeState(state, expiresAt) });
  setLoginChallengeCookie(response, challengeId);
  return response;
}
