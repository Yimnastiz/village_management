import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clearRegistrationCookie,
  getRegistrationFromRequest,
  REGISTRATION_OTP_TTL_SECONDS,
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

  const normalizedPhoneNumber = normalizePhone10(registration.phoneNumber);
  const candidates = toPhoneCandidates(normalizedPhoneNumber);

  const existingUser = await prisma.user.findFirst({
    where: { phoneNumber: { in: candidates } },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "หมายเลขนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้เบอร์อื่น" }, { status: 409 });
  }

  const phoneNumber = `+66${normalizedPhoneNumber.slice(1)}`;

  let verifyResult: any;
  try {
    verifyResult = await auth.api.verifyPhoneNumber({ body: { phoneNumber, code: parsed.data.code } });
  } catch (err: any) {
    console.error("verify-registration-otp: verifyPhoneNumber error", err);
    // Map upstream OTP not found / invalid to 401 for client
    return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 401 });
  }

  if (!verifyResult?.status) {
    return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 401 });
  }

  const createdUser = await prisma.user.create({
    data: {
      phoneNumber: normalizedPhoneNumber,
      phoneNumberVerified: true,
      name: registration.name,
      systemRole: "USER",
      registrationProvince: registration.province,
      registrationDistrict: registration.district,
      registrationSubdistrict: registration.subdistrict,
      registrationVillageId: registration.villageId,
      citizenVerifiedAt: registration.registrationMode === "HEADMAN" ? new Date() : null,
      consentAt: new Date(),
    },
  });

  await prisma.registrationTemp.update({
    where: { id: registration.id },
    data: { status: "VERIFIED" },
  });

  const response = NextResponse.json({ ok: true, userId: createdUser.id });
  clearRegistrationCookie(response);
  return response;
}
