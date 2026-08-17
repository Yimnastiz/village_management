import { AuditAction, RegistrationOtpChallengeStatus, RegistrationTempStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearRegistrationCookie, getRegistrationFromRequest, normalizePhone10, toPhoneCandidates } from "@/lib/registration-temp";
import { prisma } from "@/lib/prisma";
import { maskNationalId } from "@/lib/utils";
import { DUPLICATE_NATIONAL_ID_REASON, findBoundIdentityByNationalId } from "@/lib/identity";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/), registrationId: z.string().min(1), challengeId: z.string().min(1) });
const DELAYS = [2, 5, 15, 30, 30] as const;

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid OTP payload" }, { status: 400 });
  const draft = await getRegistrationFromRequest(request);
  if (!draft || draft.status !== RegistrationTempStatus.WAITING_OTP) return NextResponse.json({ error: "No pending registration." }, { status: 404 });
  if (draft.id !== parsed.data.registrationId) return NextResponse.json({ error: "Registration draft mismatch." }, { status: 403 });
  const phoneNumber = normalizePhone10(draft.phoneNumber);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-otp:${phoneNumber}`}))`;
    const [currentDraft, verifier, challenge] = await Promise.all([
      tx.registrationTemp.findUnique({ where: { id: draft.id } }),
      tx.registrationVerifierSession.findUnique({ where: { registrationId: draft.id } }),
      tx.registrationOtpChallenge.findUnique({ where: { phoneNumber } }),
    ]);
    if (!currentDraft || currentDraft.status !== RegistrationTempStatus.WAITING_OTP || !verifier || !challenge || challenge.id !== parsed.data.challengeId || challenge.status !== RegistrationOtpChallengeStatus.ACTIVE) return { type: "inactive" as const };
    if (!challenge.otpExpiresAt || challenge.otpExpiresAt <= now) return { type: "expired" as const };
    if (verifier.lockedUntil && verifier.lockedUntil > now) return { type: "limited" as const, retryAt: verifier.lockedUntil };
    if (verifier.nextAttemptAt && verifier.nextAttemptAt > now) return { type: "limited" as const, retryAt: verifier.nextAttemptAt };
    const ipFailures = await tx.registrationVerifierSession.aggregate({
      where: { ipHash: verifier.ipHash, updatedAt: { gt: new Date(now.getTime() - 15 * 60_000) } },
      _sum: { failedAttempts: true },
    });
    if ((ipFailures._sum.failedAttempts ?? 0) >= 20) return { type: "limited" as const, retryAt: new Date(now.getTime() + 15 * 60_000) };
    const verification = await tx.authVerification.findFirst({ where: { identifier: challenge.otpIdentifier, expiresAt: { gt: now } }, orderBy: { updatedAt: "desc" } });
    if (!verification) return { type: "expired" as const };
    const separator = verification.value.lastIndexOf(":");
    const storedCode = separator >= 0 ? verification.value.slice(0, separator) : verification.value;
    if (storedCode !== parsed.data.code) {
      const failedAttempts = verifier.failedAttempts + 1;
      const delay = DELAYS[Math.min(failedAttempts, DELAYS.length) - 1] ?? 30;
      const lockedUntil = failedAttempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : null;
      await tx.registrationVerifierSession.update({
        where: { id: verifier.id },
        data: { failedAttempts, nextAttemptAt: new Date(now.getTime() + delay * 1000), lockedUntil },
      });
      return { type: "invalid" as const, remaining: Math.max(0, 5 - failedAttempts), retryAt: lockedUntil ?? new Date(now.getTime() + delay * 1000) };
    }
    const existingUser = await tx.user.findFirst({ where: { phoneNumber: { in: toPhoneCandidates(phoneNumber) } }, select: { id: true } });
    if (existingUser) return { type: "exists" as const };
    const claimedIdentity = await findBoundIdentityByNationalId(tx, currentDraft.nationalId, undefined, currentDraft.villageId);
    if (claimedIdentity) {
      await tx.registrationTemp.update({
        where: { id: currentDraft.id },
        data: { status: RegistrationTempStatus.REJECTED, rejectReason: DUPLICATE_NATIONAL_ID_REASON, rejectedAt: now },
      });
      await tx.registrationOtpChallenge.update({ where: { id: challenge.id }, data: { status: RegistrationOtpChallengeStatus.CONSUMED } });
      await tx.authVerification.deleteMany({ where: { identifier: challenge.otpIdentifier } });
      return { type: "claimed" as const };
    }
    const user = await tx.user.create({
      data: {
        phoneNumber, phoneNumberVerified: true, name: currentDraft.name, systemRole: "USER",
        registrationProvince: currentDraft.province, registrationDistrict: currentDraft.district,
        registrationSubdistrict: currentDraft.subdistrict, registrationVillageId: currentDraft.villageId,
        citizenVerifiedAt: null, consentAt: now,
      },
      select: { id: true },
    });
    // A pending applicant owns a profile row by userId, never by national ID.
    // Multiple applicants can legitimately submit the same ID until approval.
    if (currentDraft.villageId && currentDraft.firstName && currentDraft.lastName) {
      await tx.person.create({
        data: {
          userId: user.id,
          villageId: currentDraft.villageId,
          nationalId: currentDraft.nationalId,
          firstName: currentDraft.firstName,
          lastName: currentDraft.lastName,
          phone: phoneNumber,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          villageId: currentDraft.villageId,
          action: AuditAction.CREATE,
          resource: "Person",
          metadata: { source: "REGISTRATION", maskedNationalId: maskNationalId(currentDraft.nationalId) },
        },
      });
    }
    await tx.registrationTemp.update({
      where: { id: currentDraft.id },
      data: { status: RegistrationTempStatus.VERIFIED, userId: user.id },
    });
    await tx.registrationTemp.updateMany({ where: { phoneNumber, id: { not: currentDraft.id }, status: RegistrationTempStatus.WAITING_OTP }, data: { status: RegistrationTempStatus.CANCELLED } });
    await tx.registrationOtpChallenge.update({ where: { id: challenge.id }, data: { status: RegistrationOtpChallengeStatus.CONSUMED } });
    await tx.authVerification.deleteMany({ where: { identifier: challenge.otpIdentifier } });
    return { type: "verified" as const, userId: user.id };
  });

  if (result.type === "limited" || result.type === "invalid") {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.retryAt.getTime() - Date.now()) / 1000));
    return NextResponse.json({ error: result.type === "invalid" ? `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${result.remaining} ครั้ง` : "กรุณารอก่อนลองใหม่", retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
  }
  if (result.type === "expired") return NextResponse.json({ error: "OTP หมดอายุแล้ว" }, { status: 410 });
  if (result.type === "exists") return NextResponse.json({ error: "หมายเลขนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ" }, { status: 409 });
  if (result.type === "claimed") return NextResponse.json({ error: "เลขบัตรประชาชนนี้ได้รับการยืนยันกับบัญชีอื่นแล้ว กรุณาติดต่อผู้ใหญ่บ้าน" }, { status: 409 });
  if (result.type !== "verified") return NextResponse.json({ error: "Registration challenge is no longer active." }, { status: 409 });
  const response = NextResponse.json({ ok: true, userId: result.userId });
  clearRegistrationCookie(response);
  return response;
}
