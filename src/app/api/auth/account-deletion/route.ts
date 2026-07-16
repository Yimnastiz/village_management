import { AccountStatus, AuditAction, BindingRequestStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSessionContextFromRequest } from "@/lib/access-control";
import { ACCOUNT_DELETION_GRACE_MS, ACCOUNT_DELETION_RECOVERY_COOKIE, assertSelfDeletionAllowed, createRecoveryToken, hashRecoveryToken } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEND_OTP") }),
  z.object({ action: z.literal("REQUEST_DELETION"), code: z.string().regex(/^\d{6}$/), confirmation: z.literal("ลบบัญชี"), accepted: z.literal(true) }),
]);

export async function POST(request: NextRequest) {
  const session = await getSessionContextFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await assertSelfDeletionAllowed(session.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account cannot be deleted." }, { status: 403 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { phoneNumber: true, accountStatus: true } });
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) return NextResponse.json({ error: "Account is not active." }, { status: 409 });
  const now = new Date();

  if (parsed.data.action === "SEND_OTP") {
    const existing = await prisma.accountDeletionChallenge.findUnique({ where: { userId: session.id } });
    if (existing?.lockedUntil && existing.lockedUntil > now) return NextResponse.json({ error: "Verification is temporarily locked.", retryAfterSeconds: Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / 1000) }, { status: 429 });
    if (existing?.resendAvailableAt && existing.resendAvailableAt > now) return NextResponse.json({ error: "Please wait before requesting another OTP.", retryAfterSeconds: Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000) }, { status: 429 });
    await prisma.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
    try {
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: user.phoneNumber } });
    } catch {
      await prisma.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
      return NextResponse.json({ error: "OTP provider could not send the code." }, { status: 502 });
    }
    const sentAt = new Date();
    const challenge = await prisma.accountDeletionChallenge.upsert({
      where: { userId: session.id },
      create: { userId: session.id, phoneNumber: user.phoneNumber, otpSentAt: sentAt, otpExpiresAt: new Date(sentAt.getTime() + 5 * 60_000), resendAvailableAt: new Date(sentAt.getTime() + 60_000) },
      update: { phoneNumber: user.phoneNumber, otpSentAt: sentAt, otpExpiresAt: new Date(sentAt.getTime() + 5 * 60_000), resendAvailableAt: new Date(sentAt.getTime() + 60_000), failedAttempts: 0, lockedUntil: null, verifiedAt: null },
    });
    return NextResponse.json({ ok: true, expiresAt: challenge.otpExpiresAt.toISOString(), resendAvailableAt: challenge.resendAvailableAt.toISOString() });
  }

  const challenge = await prisma.accountDeletionChallenge.findUnique({ where: { userId: session.id } });
  if (!challenge || challenge.otpExpiresAt <= now) return NextResponse.json({ error: "OTP expired." }, { status: 410 });
  if (challenge.lockedUntil && challenge.lockedUntil > now) return NextResponse.json({ error: "Verification is temporarily locked." }, { status: 429 });
  const delaySeconds = [0, 2, 5, 15, 30][Math.min(challenge.failedAttempts, 4)] ?? 30;
  const retryAt = new Date(challenge.updatedAt.getTime() + delaySeconds * 1000);
  if (challenge.failedAttempts > 0 && retryAt > now) return NextResponse.json({ error: "กรุณารอก่อนลองใหม่", retryAfterSeconds: Math.ceil((retryAt.getTime() - now.getTime()) / 1000) }, { status: 429 });
  const verification = await prisma.authVerification.findFirst({ where: { identifier: user.phoneNumber, expiresAt: { gt: now } }, orderBy: { updatedAt: "desc" } });
  const storedCode = verification?.value.split(":")[0];
  if (!verification || storedCode !== parsed.data.code) {
    const failedAttempts = challenge.failedAttempts + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : null;
    await prisma.accountDeletionChallenge.update({ where: { id: challenge.id }, data: { failedAttempts, lockedUntil } });
    return NextResponse.json({ error: lockedUntil ? "Verification is temporarily locked." : `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${5 - failedAttempts} ครั้ง` }, { status: lockedUntil ? 429 : 401 });
  }

  const recoveryToken = createRecoveryToken();
  const scheduledDeletionAt = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_MS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.id }, data: { accountStatus: AccountStatus.DELETION_PENDING, deletionRequestedAt: now, scheduledDeletionAt, deletionRecoveryHash: hashRecoveryToken(recoveryToken) } });
    await tx.bindingRequest.updateMany({ where: { userId: session.id, status: BindingRequestStatus.PENDING }, data: { status: BindingRequestStatus.CANCELLED } });
    await tx.authSession.deleteMany({ where: { userId: session.id } });
    await tx.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
    await tx.accountDeletionChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: now } });
    await tx.auditLog.create({ data: { userId: session.id, action: AuditAction.UPDATE, resource: "UserAccount", resourceId: session.id, metadata: { status: AccountStatus.DELETION_PENDING, scheduledDeletionAt: scheduledDeletionAt.toISOString() } } });
  });
  const response = NextResponse.json({ ok: true, scheduledDeletionAt: scheduledDeletionAt.toISOString() });
  response.cookies.set(ACCOUNT_DELETION_RECOVERY_COOKIE, recoveryToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ACCOUNT_DELETION_GRACE_MS / 1000 });
  return response;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(ACCOUNT_DELETION_RECOVERY_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Recovery authorization required." }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { deletionRecoveryHash: hashRecoveryToken(token), accountStatus: AccountStatus.DELETION_PENDING, scheduledDeletionAt: { gt: new Date() } }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Recovery authorization is invalid or expired." }, { status: 401 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { accountStatus: AccountStatus.ACTIVE, deletionRequestedAt: null, scheduledDeletionAt: null, deletionRecoveryHash: null } }),
    prisma.accountDeletionChallenge.deleteMany({ where: { userId: user.id } }),
    prisma.auditLog.create({ data: { userId: user.id, action: AuditAction.UPDATE, resource: "UserAccount", resourceId: user.id, metadata: { status: AccountStatus.ACTIVE, deletionCancelled: true } } }),
  ]);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCOUNT_DELETION_RECOVERY_COOKIE);
  return response;
}
