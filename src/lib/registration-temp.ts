import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { RegistrationTempStatus } from "@prisma/client";

export const REGISTRATION_COOKIE_NAME = "registration_id";
export const REGISTRATION_OTP_TTL_SECONDS = 5 * 60;
export const REGISTRATION_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const REGISTRATION_OTP_MAX_RESENDS = 5;
export const REGISTRATION_OTP_MAX_FAILED_ATTEMPTS = 5;
export const REGISTRATION_OTP_LOCK_DURATION_MS = 15 * 60 * 1000;
export const REGISTRATION_OTP_MIN_VERIFY_INTERVAL_MS = 2 * 1000;

export type RegistrationTempRecord = {
  id: string;
  phoneNumber: string;
  registrationMode: string;
  name: string;
  nationalId: string;
  province: string;
  district: string;
  subdistrict: string;
  villageId: string;
  callbackUrl: string | null;
  status: RegistrationTempStatus;
  rejectReason: string | null;
  rejectedAt: Date | null;
  otpSentAt: Date | null;
  otpResendCount: number;
  otpFailedCount: number;
  otpLastAttemptAt: Date | null;
  otpLockedUntil: Date | null;
  expiresAt: Date;
};

export function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function toPhoneCandidates(raw: string): string[] {
  const normalized = normalizePhone10(raw);
  if (!/^\d{10}$/.test(normalized)) {
    return [];
  }

  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith("0")) {
    candidates.add(`+66${normalized.slice(1)}`);
  }

  return Array.from(candidates);
}

export function createRegistrationCookie(response: NextResponse, registrationId: string) {
  response.cookies.set({
    name: REGISTRATION_COOKIE_NAME,
    value: registrationId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REGISTRATION_OTP_TTL_SECONDS,
  });
}

export function clearRegistrationCookie(response: NextResponse) {
  response.cookies.delete(REGISTRATION_COOKIE_NAME);
}

function getRegistrationIdFromRequest(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get("registrationId") ?? request.cookies.get(REGISTRATION_COOKIE_NAME)?.value ?? null;
}

export async function getRegistrationFromRequest(
  request: NextRequest
): Promise<RegistrationTempRecord | null> {
  const registrationId = getRegistrationIdFromRequest(request);
  if (!registrationId) {
    return null;
  }

  const registration = await prisma.registrationTemp.findUnique({ where: { id: registrationId } });

  if (
    !registration ||
    (registration.status !== RegistrationTempStatus.WAITING_OTP && registration.status !== RegistrationTempStatus.REJECTED) ||
    registration.expiresAt <= new Date()
  ) {
    return null;
  }

  return {
    id: registration.id,
    phoneNumber: registration.phoneNumber,
    registrationMode: registration.registrationMode,
    name: registration.name,
    nationalId: registration.nationalId,
    province: registration.province,
    district: registration.district,
    subdistrict: registration.subdistrict,
    villageId: registration.villageId,
    callbackUrl: registration.callbackUrl,
    status: registration.status,
    rejectReason: registration.rejectReason,
    rejectedAt: registration.rejectedAt,
    otpSentAt: registration.otpSentAt,
    otpResendCount: registration.otpResendCount,
    otpFailedCount: registration.otpFailedCount,
    otpLastAttemptAt: registration.otpLastAttemptAt,
    otpLockedUntil: registration.otpLockedUntil,
    expiresAt: registration.expiresAt,
  };
}

export function getRegistrationLockMessage(lockUntil: Date | null, now = new Date()): string | null {
  if (!lockUntil || lockUntil <= now) {
    return null;
  }

  const remainingSeconds = Math.max(1, Math.ceil((lockUntil.getTime() - now.getTime()) / 1000));
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  if (remainingMinutes >= 1) {
    return `ระบบถูกล็อกชั่วคราว กรุณารออีกประมาณ ${remainingMinutes} นาทีแล้วลองใหม่`;
  }

  return `ระบบถูกล็อกชั่วคราว กรุณารออีกประมาณ ${remainingSeconds} วินาทีแล้วลองใหม่`;
}

export function getRegistrationResendCooldownMessage(lastSentAt: Date | null, now = new Date()): string | null {
  if (!lastSentAt) {
    return null;
  }

  const elapsed = now.getTime() - lastSentAt.getTime();
  if (elapsed >= REGISTRATION_OTP_RESEND_COOLDOWN_MS) {
    return null;
  }

  const remainingSeconds = Math.max(1, Math.ceil((REGISTRATION_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
  return `กรุณารออีก ${remainingSeconds} วินาทีจึงจะส่ง OTP ใหม่ได้`;
}

export function getRegistrationAttemptCooldownMessage(lastAttemptAt: Date | null, now = new Date()): string | null {
  if (!lastAttemptAt) {
    return null;
  }

  const elapsed = now.getTime() - lastAttemptAt.getTime();
  if (elapsed >= REGISTRATION_OTP_MIN_VERIFY_INTERVAL_MS) {
    return null;
  }

  const remainingSeconds = Math.max(1, Math.ceil((REGISTRATION_OTP_MIN_VERIFY_INTERVAL_MS - elapsed) / 1000));
  return `กรุณารออีก ${remainingSeconds} วินาทีแล้วลองกรอก OTP ใหม่`;
}

export async function hasExistingUserWithPhone(phoneNumber: string) {
  const candidates = toPhoneCandidates(phoneNumber);
  if (candidates.length === 0) {
    return false;
  }

  const existingUser = await prisma.user.findFirst({
    where: { phoneNumber: { in: candidates } },
    select: { id: true },
  });
  return Boolean(existingUser);
}

export async function findPendingRegistrationByPhone(phoneNumber: string) {
  return prisma.registrationTemp.findFirst({
    where: {
      phoneNumber,
      status: RegistrationTempStatus.WAITING_OTP,
      expiresAt: { gt: new Date() },
    },
    orderBy: { updatedAt: "desc" },
  });
}
