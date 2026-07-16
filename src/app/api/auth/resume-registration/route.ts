import { NextRequest, NextResponse } from "next/server";
import { getRegistrationFromRequest } from "@/lib/registration-temp";

export async function GET(request: NextRequest) {
  const registration = await getRegistrationFromRequest(request);

  if (!registration) {
    return NextResponse.json({ ok: false, error: "No pending registration." }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      registrationId: registration.id,
      mode: "signup",
      phone: registration.phoneNumber,
      phoneNumber: registration.phoneNumber,
      registrationMode: registration.registrationMode.toLowerCase(),
      name: registration.name,
      nationalId: registration.nationalId,
      province: registration.province,
      district: registration.district,
      subdistrict: registration.subdistrict,
      villageId: registration.villageId,
      callbackUrl: registration.callbackUrl,
      status: registration.status,
      rejectReason: registration.rejectReason,
      rejectedAt: registration.rejectedAt?.toISOString() ?? null,
      otpSentAt: registration.otpSentAt?.toISOString() ?? null,
      resendAvailableAt: registration.otpSentAt
        ? new Date(registration.otpSentAt.getTime() + 60_000).toISOString()
        : null,
      otpResendCount: registration.otpResendCount,
      otpFailedCount: registration.otpFailedCount,
      otpLastAttemptAt: registration.otpLastAttemptAt?.toISOString() ?? null,
      otpLockedUntil: registration.otpLockedUntil?.toISOString() ?? null,
      expiresAt: registration.expiresAt.toISOString(),
    },
  });
}
