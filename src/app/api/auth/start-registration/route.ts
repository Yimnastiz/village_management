import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATION_OTP_TTL_SECONDS,
  createRegistrationCookie,
  findPendingRegistrationByPhone,
  hasExistingUserWithPhone,
  normalizePhone10,
} from "@/lib/registration-temp";

const startRegistrationSchema = z.object({
  phoneNumber: z.string().trim().min(1),
  registrationMode: z.enum(["resident", "headman"]).default("resident"),
  name: z.string().trim().min(1),
  nationalId: z.string().trim().regex(/^\d{13}$/),
  province: z.string().trim().min(1),
  district: z.string().trim().min(1),
  subdistrict: z.string().trim().min(1),
  villageId: z.string().trim().min(1),
  callbackUrl: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = startRegistrationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone10(parsed.data.phoneNumber);
  if (!/^\d{10}$/.test(normalizedPhone)) {
    return NextResponse.json(
      { error: "Phone number must be exactly 10 digits." },
      { status: 400 }
    );
  }

  if (await hasExistingUserWithPhone(normalizedPhone)) {
    return NextResponse.json(
      { error: "หมายเลขนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้เบอร์อื่น" },
      { status: 409 }
    );
  }

  const existingPending = await findPendingRegistrationByPhone(normalizedPhone);
  const expiresAt = new Date(Date.now() + REGISTRATION_OTP_TTL_SECONDS * 1000);

  let registration;
  const registrationMode = parsed.data.registrationMode.toUpperCase() as "RESIDENT" | "HEADMAN";

  if (existingPending) {
    registration = await prisma.registrationTemp.update({
      where: { id: existingPending.id },
      data: {
        registrationMode,
        name: parsed.data.name,
        nationalId: parsed.data.nationalId,
        province: parsed.data.province,
        district: parsed.data.district,
        subdistrict: parsed.data.subdistrict,
        villageId: parsed.data.villageId,
        callbackUrl: parsed.data.callbackUrl ?? null,
        status: "WAITING_OTP",
        expiresAt,
      },
    });
  } else {
    registration = await prisma.registrationTemp.create({
      data: {
        phoneNumber: normalizedPhone,
        registrationMode,
        name: parsed.data.name,
        nationalId: parsed.data.nationalId,
        province: parsed.data.province,
        district: parsed.data.district,
        subdistrict: parsed.data.subdistrict,
        villageId: parsed.data.villageId,
        callbackUrl: parsed.data.callbackUrl ?? null,
        expiresAt,
      },
    });
  }

  await auth.api.sendPhoneNumberOTP({
    phoneNumber: normalizedPhone,
  });

  const response = NextResponse.json({ ok: true, registrationId: registration.id });
  createRegistrationCookie(response, registration.id);
  return response;
}
