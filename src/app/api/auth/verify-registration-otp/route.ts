import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clearRegistrationCookie,
  getRegistrationFromRequest,
  getRegistrationAttemptCooldownMessage,
  getRegistrationLockMessage,
  REGISTRATION_OTP_LOCK_DURATION_MS,
  REGISTRATION_OTP_MAX_FAILED_ATTEMPTS,
  normalizePhone10,
  toPhoneCandidates,
} from "@/lib/registration-temp";

const verifyOtpSchema = z.object({
  code: z.string().trim().length(6),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid OTP payload" }, { status: 400 });
  }

  const registration = await getRegistrationFromRequest(request);
  if (!registration) {
    return NextResponse.json({ error: "No pending registration or OTP expired." }, { status: 404 });
  }

  if (registration.status === "REJECTED") {
    return NextResponse.json(
      {
        error: registration.rejectReason
          ? `คำขอสมัครของคุณถูกปฏิเสธ: ${registration.rejectReason}`
          : "คำขอสมัครของคุณถูกปฏิเสธ กรุณาเริ่มสมัครใหม่",
      },
      { status: 403 }
    );
  }

  if (registration.status !== "WAITING_OTP") {
    return NextResponse.json({ error: "No pending registration or OTP expired." }, { status: 404 });
  }

  const now = new Date();
  const lockMessage = getRegistrationLockMessage(registration.otpLockedUntil, now);
  if (lockMessage) {
    return NextResponse.json({ error: lockMessage }, { status: 423 });
  }

  const cooldownMessage = getRegistrationAttemptCooldownMessage(registration.otpLastAttemptAt, now);
  if (cooldownMessage) {
    return NextResponse.json({ error: cooldownMessage }, { status: 429 });
  }

  const normalizedPhoneNumber = normalizePhone10(registration.phoneNumber);
  const candidates = toPhoneCandidates(normalizedPhoneNumber);

  const existingUser = await prisma.user.findFirst({
    where: { phoneNumber: { in: candidates } },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "หมายเลขนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้เบอร์อื่น" }, { status: 409 });
  }

  // Use the exact same identifier format used when sending the OTP.
  const phoneNumber = normalizedPhoneNumber;

  let verifyResult: Awaited<ReturnType<typeof auth.api.verifyPhoneNumber>> | null = null;
  try {
    verifyResult = await auth.api.verifyPhoneNumber({ body: { phoneNumber, code: parsed.data.code } });
  } catch (err: unknown) {
    console.error("verify-registration-otp: verifyPhoneNumber failed", {
      errorName: err instanceof Error ? err.name : "UnknownError",
    });
    const nextFailedCount = registration.otpFailedCount + 1;
    const lockedUntil = nextFailedCount >= REGISTRATION_OTP_MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + REGISTRATION_OTP_LOCK_DURATION_MS)
      : null;

    await prisma.registrationTemp.update({
      where: { id: registration.id },
      data: {
        otpFailedCount: nextFailedCount,
        otpLastAttemptAt: now,
        otpLockedUntil: lockedUntil,
      },
    });

    if (lockedUntil) {
      return NextResponse.json(
        {
          error: `กรอกรหัสผิดเกินกำหนด ระบบถูกล็อกชั่วคราวประมาณ ${Math.ceil(REGISTRATION_OTP_LOCK_DURATION_MS / 60000)} นาที`,
        },
        { status: 423 }
      );
    }

    return NextResponse.json(
      {
        error: `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${REGISTRATION_OTP_MAX_FAILED_ATTEMPTS - nextFailedCount} ครั้ง`,
      },
      { status: 401 }
    );
  }

  if (!verifyResult?.status) {
    const nextFailedCount = registration.otpFailedCount + 1;
    const lockedUntil = nextFailedCount >= REGISTRATION_OTP_MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + REGISTRATION_OTP_LOCK_DURATION_MS)
      : null;

    await prisma.registrationTemp.update({
      where: { id: registration.id },
      data: {
        otpFailedCount: nextFailedCount,
        otpLastAttemptAt: now,
        otpLockedUntil: lockedUntil,
      },
    });

    if (lockedUntil) {
      return NextResponse.json(
        {
          error: `กรอกรหัสผิดเกินกำหนด ระบบถูกล็อกชั่วคราวประมาณ ${Math.ceil(REGISTRATION_OTP_LOCK_DURATION_MS / 60000)} นาที`,
        },
        { status: 423 }
      );
    }

    return NextResponse.json(
      {
        error: `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${REGISTRATION_OTP_MAX_FAILED_ATTEMPTS - nextFailedCount} ครั้ง`,
      },
      { status: 401 }
    );
  }

  const verifiedAt = new Date();
  const createdUser = await prisma.user.upsert({
    where: { phoneNumber: normalizedPhoneNumber },
    update: {
      phoneNumberVerified: true,
      name: registration.name,
      systemRole: "USER",
      registrationProvince: registration.province,
      registrationDistrict: registration.district,
      registrationSubdistrict: registration.subdistrict,
      registrationVillageId: registration.villageId,
      citizenVerifiedAt: null,
      consentAt: verifiedAt,
    },
    create: {
      phoneNumber: normalizedPhoneNumber,
      phoneNumberVerified: true,
      name: registration.name,
      systemRole: "USER",
      registrationProvince: registration.province,
      registrationDistrict: registration.district,
      registrationSubdistrict: registration.subdistrict,
      registrationVillageId: registration.villageId,
      citizenVerifiedAt: null,
      consentAt: verifiedAt,
    },
  });

  await prisma.registrationTemp.update({
    where: { id: registration.id },
    data: {
      status: "VERIFIED",
      otpFailedCount: 0,
      otpResendCount: 0,
      otpLastAttemptAt: now,
      otpLockedUntil: null,
    },
  });

  const response = NextResponse.json({ ok: true, userId: createdUser.id });
  clearRegistrationCookie(response);
  return response;
}
