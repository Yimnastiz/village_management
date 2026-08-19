import { createHash } from "node:crypto";
import { RegistrationOtpChallengeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";
import { createRegistrationCookie, hasExistingUserWithPhone, normalizePhone10, REGISTRATION_OTP_TTL_SECONDS } from "@/lib/registration-temp";
import { finalizeAccountDeletion } from "@/lib/account-deletion";
import { getDevOtpCode, isDevOtpBypassEnabled } from "@/lib/dev-otp";
import { findBoundIdentityByNationalId } from "@/lib/identity";
import { isValidThaiName, normalizeNationalId, normalizeThaiName } from "@/lib/thai-identity";
import { normalizePersonGender, validateOptionalPersonDate } from "@/lib/person-validation";

const schema = z.object({
  phoneNumber: z.string().trim().min(1), registrationMode: z.literal("resident").optional(),
  name: z.string().trim().min(1).optional(), firstName: z.string().trim().min(1), lastName: z.string().trim().min(1),
  nationalId: z.string().trim().min(1), dateOfBirth: z.string().trim().min(1), gender: z.string().trim().min(1), province: z.string().trim().min(1), district: z.string().trim().min(1),
  subdistrict: z.string().trim().min(1), villageId: z.string().trim().min(1), callbackUrl: z.string().trim().nullable().optional(),
});

function ipHash(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
  const phoneNumber = normalizePhone10(parsed.data.phoneNumber);
  if (!phoneNumber) return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
  if (!isValidThaiName(parsed.data.firstName)) return NextResponse.json({ error: "กรุณากรอกชื่อจริงเป็นภาษาไทยเท่านั้น" }, { status: 400 });
  if (!isValidThaiName(parsed.data.lastName)) return NextResponse.json({ error: "กรุณากรอกนามสกุลจริงเป็นภาษาไทยเท่านั้น" }, { status: 400 });
  const firstName = normalizeThaiName(parsed.data.firstName).trim();
  const lastName = normalizeThaiName(parsed.data.lastName).trim();
  const nationalId = normalizeNationalId(parsed.data.nationalId);
  if (!/^\d{13}$/.test(nationalId)) return NextResponse.json({ error: "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก" }, { status: 400 });
  const dateOfBirth = validateOptionalPersonDate(parsed.data.dateOfBirth);
  if (!dateOfBirth.valid) {
    return NextResponse.json({ error: dateOfBirth.reason === "FUTURE" ? "วันเกิดต้องไม่เป็นวันในอนาคต" : "วันเกิดไม่ถูกต้อง" }, { status: 400 });
  }
  if (!dateOfBirth.value) return NextResponse.json({ error: "วันเกิดไม่ถูกต้อง" }, { status: 400 });
  const gender = normalizePersonGender(parsed.data.gender);
  if (!gender) return NextResponse.json({ error: "เพศไม่ถูกต้อง" }, { status: 400 });
  const dueAccount = await prisma.user.findFirst({ where: { phoneNumber: { in: [phoneNumber, `+66${phoneNumber.slice(1)}`] }, accountStatus: "DELETION_PENDING", scheduledDeletionAt: { lte: new Date() } }, select: { id: true } });
  if (dueAccount) await finalizeAccountDeletion(dueAccount.id);
  if (await hasExistingUserWithPhone(phoneNumber)) return NextResponse.json({ error: "หมายเลขนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ" }, { status: 409 });
  const name = `${firstName} ${lastName}`;
  if (!name) return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });

  const now = new Date();
  const hash = ipHash(request);
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-otp:${phoneNumber}`}))`;
    const claimedIdentity = await findBoundIdentityByNationalId(tx, nationalId, undefined, parsed.data.villageId);
    if (claimedIdentity) return { limited: false as const, claimed: true as const };
    const recentSessions = await tx.registrationVerifierSession.count({ where: { ipHash: hash, createdAt: { gt: new Date(now.getTime() - 15 * 60_000) } } });
    if (recentSessions >= 10) return { limited: true as const };
    const challenge = await tx.registrationOtpChallenge.findUnique({ where: { phoneNumber } });
    const resumable = challenge && (challenge.status === RegistrationOtpChallengeStatus.PENDING_SEND || challenge.status === RegistrationOtpChallengeStatus.ACTIVE)
      && Boolean(challenge.otpExpiresAt ? challenge.otpExpiresAt > now : now.getTime() - challenge.updatedAt.getTime() < 30_000);
    const draft = await tx.registrationTemp.create({
      data: {
        phoneNumber, registrationMode: "RESIDENT", name, firstName, lastName, nationalId, dateOfBirth: dateOfBirth.value, gender,
        province: parsed.data.province, district: parsed.data.district, subdistrict: parsed.data.subdistrict,
        villageId: parsed.data.villageId, callbackUrl: sanitizeInternalCallbackUrl(parsed.data.callbackUrl),
        expiresAt: challenge?.otpExpiresAt && challenge.otpExpiresAt > now ? challenge.otpExpiresAt : new Date(now.getTime() + REGISTRATION_OTP_TTL_SECONDS * 1000),
      },
    });
    await tx.registrationVerifierSession.create({ data: { registrationId: draft.id, ipHash: hash, expiresAt: new Date(now.getTime() + 20 * 60_000) } });
    if (resumable) return { limited: false as const, claimed: false as const, resume: true as const, draft, challenge };
    await tx.authVerification.deleteMany({ where: { identifier: phoneNumber } });
    const reserved = await tx.registrationOtpChallenge.upsert({
      where: { phoneNumber },
      create: { phoneNumber, otpIdentifier: phoneNumber, status: RegistrationOtpChallengeStatus.PENDING_SEND, sendWindowStartedAt: now, sendCount: 1 },
      update: { otpIdentifier: phoneNumber, status: RegistrationOtpChallengeStatus.PENDING_SEND, sendCount: { increment: 1 } },
    });
    return { limited: false as const, claimed: false as const, resume: false as const, draft, challenge: reserved };
  });
  if (prepared.limited) return NextResponse.json({ error: "Too many verification sessions.", retryAfterSeconds: 900 }, { status: 429 });
  if (prepared.claimed) return NextResponse.json({ error: "เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว กรุณาเข้าสู่ระบบบัญชีเดิม หรือติดต่อผู้ดูแลหมู่บ้าน" }, { status: 409 });

  let challenge = prepared.challenge;
  let outcome = "RESUME_EXISTING_CHALLENGE";
  if (prepared.resume && challenge.status === RegistrationOtpChallengeStatus.PENDING_SEND) {
    for (let attempt = 0; attempt < 20 && challenge.status === RegistrationOtpChallengeStatus.PENDING_SEND; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      challenge = await prisma.registrationOtpChallenge.findUniqueOrThrow({ where: { id: challenge.id } });
    }
  }
  if (!prepared.resume) {
    try {
      if (isDevOtpBypassEnabled()) {
        const sentAt = new Date();
        await prisma.$transaction([
          prisma.authVerification.deleteMany({ where: { identifier: phoneNumber } }),
          prisma.authVerification.create({ data: { identifier: phoneNumber, value: `${getDevOtpCode()}:0`, expiresAt: new Date(sentAt.getTime() + REGISTRATION_OTP_TTL_SECONDS * 1000) } }),
        ]);
      } else {
        await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
      }
      const sentAt = new Date();
      challenge = await prisma.registrationOtpChallenge.update({
        where: { id: challenge.id },
        data: { status: RegistrationOtpChallengeStatus.ACTIVE, otpSentAt: sentAt, otpExpiresAt: new Date(sentAt.getTime() + REGISTRATION_OTP_TTL_SECONDS * 1000), resendAvailableAt: new Date(sentAt.getTime() + 60_000), resendCount: { increment: 1 } },
      });
      await prisma.registrationTemp.update({ where: { id: prepared.draft.id }, data: { expiresAt: challenge.otpExpiresAt!, otpSentAt: sentAt } });
      outcome = isDevOtpBypassEnabled() ? "DEV_OTP_READY" : "OTP_SENT";
    } catch {
      await prisma.$transaction([
        prisma.authVerification.deleteMany({ where: { identifier: phoneNumber } }),
        prisma.registrationOtpChallenge.update({ where: { id: challenge.id }, data: { status: RegistrationOtpChallengeStatus.SEND_FAILED } }),
      ]);
      return NextResponse.json({ error: "OTP provider could not send the code." }, { status: 502 });
    }
  }
  const response = NextResponse.json({ ok: true, outcome, registrationId: prepared.draft.id, data: {
    otpSentAt: challenge.otpSentAt?.toISOString() ?? null, expiresAt: challenge.otpExpiresAt?.toISOString() ?? null,
    resendAvailableAt: challenge.resendAvailableAt?.toISOString() ?? null, otpLockedUntil: null,
  } });
  createRegistrationCookie(response, prepared.draft.id);
  return response;
}
