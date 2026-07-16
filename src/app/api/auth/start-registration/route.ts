import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATION_OTP_MAX_RESENDS,
  createRegistrationCookie,
  findPendingRegistrationByPhone,
  getRegistrationLockMessage,
  getRegistrationResendCooldownMessage,
  REGISTRATION_OTP_TTL_SECONDS,
  hasExistingUserWithPhone,
  normalizePhone10,
} from "@/lib/registration-temp";

const startRegistrationSchema = z.object({
  phoneNumber: z.string().trim().min(1),
  registrationMode: z.enum(["resident", "headman"]).default("resident"),
  // accept either `name` or `firstName`+`lastName` from different clients
  name: z.string().trim().min(1).optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  nationalId: z.string().trim().regex(/^\d{13}$/),
  province: z.string().trim().min(1),
  district: z.string().trim().min(1),
  subdistrict: z.string().trim().min(1),
  villageId: z.string().trim().min(1),
  // accept null from some clients or a trimmed string
  callbackUrl: z.string().trim().nullable().optional(),
});

export async function POST(request: NextRequest) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    try {
      const raw = await request.text();
      console.error("start-registration: failed to parse JSON body", { hasBody: raw.length > 0, bodyLength: raw.length });
      payload = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("start-registration: unable to parse body", e);
      payload = null;
    }
  }

  const parsed = startRegistrationSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("start-registration: validation failed", parsed.error.format());
    return NextResponse.json({ error: "Invalid registration payload", details: parsed.error.format() }, { status: 400 });
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
  const now = new Date();

  let registration;
  // compute name if provided as firstName+lastName
  const providedName = parsed.data.name ?? `${parsed.data.firstName ?? ""} ${parsed.data.lastName ?? ""}`.trim();
  if (!providedName) {
    return NextResponse.json({ error: "Invalid registration payload: name missing" }, { status: 400 });
  }

  const registrationMode = parsed.data.registrationMode.toUpperCase() as "RESIDENT" | "HEADMAN";

  if (existingPending) {
    const lockMessage = getRegistrationLockMessage(existingPending.otpLockedUntil, now);
    if (lockMessage) {
      return NextResponse.json({ error: lockMessage }, { status: 423 });
    }

    const cooldownMessage = getRegistrationResendCooldownMessage(existingPending.otpSentAt, now);
    if (cooldownMessage) {
      return NextResponse.json({ error: cooldownMessage }, { status: 429 });
    }

    if (existingPending.otpResendCount >= REGISTRATION_OTP_MAX_RESENDS) {
      const lockedUntil = new Date(now.getTime() + REGISTRATION_OTP_TTL_SECONDS * 1000);
      await prisma.registrationTemp.update({
        where: { id: existingPending.id },
        data: {
          otpLockedUntil: lockedUntil,
        },
      });

      return NextResponse.json(
        { error: `ส่ง OTP ได้สูงสุด ${REGISTRATION_OTP_MAX_RESENDS} ครั้ง กรุณารอแล้วลองใหม่อีกครั้ง` },
        { status: 429 }
      );
    }

    registration = await prisma.registrationTemp.update({
      where: { id: existingPending.id },
      data: {
        registrationMode,
        name: providedName,
        nationalId: parsed.data.nationalId,
        province: parsed.data.province,
        district: parsed.data.district,
        subdistrict: parsed.data.subdistrict,
        villageId: parsed.data.villageId,
        callbackUrl: parsed.data.callbackUrl ?? null,
        status: "WAITING_OTP",
        expiresAt,
        otpSentAt: now,
        otpResendCount: existingPending.otpResendCount + 1,
        otpFailedCount: 0,
        otpLastAttemptAt: null,
        otpLockedUntil: null,
      },
    });
  } else {
    registration = await prisma.registrationTemp.create({
      data: {
        phoneNumber: normalizedPhone,
        registrationMode,
        name: providedName,
        nationalId: parsed.data.nationalId,
        province: parsed.data.province,
        district: parsed.data.district,
        subdistrict: parsed.data.subdistrict,
        villageId: parsed.data.villageId,
        callbackUrl: parsed.data.callbackUrl ?? null,
        expiresAt,
        otpSentAt: now,
        otpResendCount: 1,
        otpFailedCount: 0,
      },
    });
  }

  await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: normalizedPhone } });

  const response = NextResponse.json({ ok: true, registrationId: registration.id });
  createRegistrationCookie(response, registration.id);
  return response;
}
