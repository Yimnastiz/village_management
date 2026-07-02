import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { RegistrationTempStatus } from "@prisma/client";

export const REGISTRATION_COOKIE_NAME = "registration_id";
export const REGISTRATION_OTP_TTL_SECONDS = 5 * 60;

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
  response.cookies.delete(REGISTRATION_COOKIE_NAME, { path: "/" });
}

export async function getRegistrationFromRequest(
  request: NextRequest
): Promise<null | {
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
  expiresAt: Date;
}> {
  const registrationId = request.cookies.get(REGISTRATION_COOKIE_NAME)?.value ?? null;
  if (!registrationId) {
    return null;
  }

  const registration = await prisma.registrationTemp.findUnique({
    where: { id: registrationId },
  });

  if (
    !registration ||
    registration.status !== RegistrationTempStatus.WAITING_OTP ||
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
    expiresAt: registration.expiresAt,
  };
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
