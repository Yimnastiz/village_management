import { NextRequest, NextResponse } from "next/server";
import { getRegistrationFromRequest } from "@/lib/registration-temp";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const registration = await getRegistrationFromRequest(request);

  if (!registration) {
    return NextResponse.json({ ok: false, error: "No pending registration." }, { status: 200 });
  }
  const [challenge, verifier, village] = await Promise.all([
    prisma.registrationOtpChallenge.findUnique({ where: { phoneNumber: registration.phoneNumber } }),
    prisma.registrationVerifierSession.findUnique({ where: { registrationId: registration.id } }),
    prisma.village.findUnique({ where: { id: registration.villageId }, select: { name: true, moo: true } }),
  ]);
  if (!challenge || !verifier) return NextResponse.json({ ok: false, error: "No pending registration." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: {
      registrationId: registration.id,
      mode: "signup",
      phone: registration.phoneNumber,
      phoneNumber: registration.phoneNumber,
      registrationMode: registration.registrationMode.toLowerCase(),
      name: registration.name,
      firstName: registration.firstName,
      lastName: registration.lastName,
      nationalId: registration.nationalId,
      province: registration.province,
      district: registration.district,
      subdistrict: registration.subdistrict,
      villageId: registration.villageId,
      villageName: village?.name ?? null,
      villageMoo: village?.moo ?? null,
      callbackUrl: registration.callbackUrl,
      status: registration.status,
      rejectReason: registration.rejectReason,
      rejectedAt: registration.rejectedAt?.toISOString() ?? null,
      challengeId: challenge.id,
      challengeStatus: challenge.status,
      otpSentAt: challenge.otpSentAt?.toISOString() ?? null,
      resendAvailableAt: challenge.resendAvailableAt?.toISOString() ?? null,
      otpResendCount: challenge.resendCount,
      otpFailedCount: verifier.failedAttempts,
      otpLastAttemptAt: verifier.updatedAt.toISOString(),
      otpLockedUntil: verifier.lockedUntil?.toISOString() ?? null,
      retryAfterSeconds: verifier.nextAttemptAt ? Math.max(0, Math.ceil((verifier.nextAttemptAt.getTime() - Date.now()) / 1000)) : 0,
      expiresAt: challenge.otpExpiresAt?.toISOString() ?? registration.expiresAt.toISOString(),
    },
  });
}
