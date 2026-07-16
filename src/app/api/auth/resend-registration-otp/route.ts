import { RegistrationOtpChallengeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRegistrationFromRequest, normalizePhone10, REGISTRATION_OTP_TTL_SECONDS } from "@/lib/registration-temp";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const draft = await getRegistrationFromRequest(request);
  if (!draft) return NextResponse.json({ error: "No pending registration." }, { status: 404 });
  const phoneNumber = normalizePhone10(draft.phoneNumber);
  const now = new Date();
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-otp:${phoneNumber}`}))`;
    const challenge = await tx.registrationOtpChallenge.findUnique({ where: { phoneNumber } });
    if (!challenge) return { allowed: false as const, status: 404, retryAt: null };
    if (challenge.resendAvailableAt && challenge.resendAvailableAt > now) return { allowed: false as const, status: 429, retryAt: challenge.resendAvailableAt };
    if (challenge.sendCount >= 5 && now.getTime() - challenge.sendWindowStartedAt.getTime() < 15 * 60_000) {
      return { allowed: false as const, status: 429, retryAt: new Date(challenge.sendWindowStartedAt.getTime() + 15 * 60_000) };
    }
    await tx.authVerification.deleteMany({ where: { identifier: challenge.otpIdentifier } });
    const updated = await tx.registrationOtpChallenge.update({
      where: { id: challenge.id },
      data: { status: RegistrationOtpChallengeStatus.PENDING_SEND, sendCount: { increment: 1 } },
    });
    return { allowed: true as const, challenge: updated };
  });
  if (!reserved.allowed) {
    const retryAfterSeconds = reserved.retryAt ? Math.max(1, Math.ceil((reserved.retryAt.getTime() - Date.now()) / 1000)) : undefined;
    return NextResponse.json({ error: "กรุณารอก่อนส่ง OTP ใหม่", retryAfterSeconds }, { status: reserved.status, headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined });
  }
  try {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: reserved.challenge.otpIdentifier } });
  } catch {
    await prisma.$transaction([
      prisma.authVerification.deleteMany({ where: { identifier: reserved.challenge.otpIdentifier } }),
      prisma.registrationOtpChallenge.update({ where: { id: reserved.challenge.id }, data: { status: RegistrationOtpChallengeStatus.SEND_FAILED } }),
    ]);
    return NextResponse.json({ error: "OTP provider could not send the code." }, { status: 502 });
  }
  const sentAt = new Date();
  const challenge = await prisma.registrationOtpChallenge.update({
    where: { id: reserved.challenge.id },
    data: { status: RegistrationOtpChallengeStatus.ACTIVE, otpSentAt: sentAt, otpExpiresAt: new Date(sentAt.getTime() + REGISTRATION_OTP_TTL_SECONDS * 1000), resendAvailableAt: new Date(sentAt.getTime() + 60_000), resendCount: { increment: 1 } },
  });
  return NextResponse.json({ ok: true, outcome: "OTP_SENT", data: { otpSentAt: challenge.otpSentAt?.toISOString(), expiresAt: challenge.otpExpiresAt?.toISOString(), resendAvailableAt: challenge.resendAvailableAt?.toISOString() } });
}
