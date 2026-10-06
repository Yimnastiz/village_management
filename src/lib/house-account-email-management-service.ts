import { AuditAction, Prisma } from "@prisma/client";
import {
  AccountEmailServiceError,
  activateAccountEmailInTransaction,
  lockAccountEmailOwnerNamespace,
  releasePendingHouseAccountEmailInTransaction,
  reserveEmailForHouseAccountInTransaction,
} from "@/lib/account-email-service";
import { maskEmail, normalizeAccountEmail } from "@/lib/account-email";
import type { SessionContext } from "@/lib/access-control";
import { getConfiguredVillage } from "@/lib/configured-village";
import { readEmailOtpConfig } from "@/lib/email/email-otp-config";
import {
  consumeVerifiedEmailOtpChallenge,
  EmailOtpServiceError,
  issueEmailOtpChallenge,
  resendEmailOtpChallenge,
  verifyEmailOtpChallenge,
  type EmailOtpClientContext,
} from "@/lib/email/email-otp-service";
import type { HouseAccountEmailFlow } from "@/lib/house-account-email-access";
import {
  canRemoveAccountEmail,
  chooseCanonicalReplacement,
  MAX_HOUSE_ACCOUNT_EMAILS,
} from "@/lib/house-account-email-policy";
import { revokeSessionsForAccountEmail } from "@/lib/account-login-service";
import { prisma } from "@/lib/prisma";
import { writeVillageAuditLog } from "@/lib/audit-log";

export type HouseAccountEmailManagementErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_UNAVAILABLE"
  | "FLOW_NOT_FOUND"
  | "FLOW_EXPIRED"
  | "EMAIL_ALREADY_ACTIVE"
  | "EMAIL_UNAVAILABLE"
  | "MAX_ACTIVE_EMAILS"
  | "INVALID_EMAIL"
  | "INVALID_CODE"
  | "OTP_UNAVAILABLE"
  | "RATE_LIMITED"
  | "DELIVERY_FAILED"
  | "EMAIL_NOT_FOUND"
  | "LAST_ACTIVE_EMAIL";

export class HouseAccountEmailManagementError extends Error {
  constructor(readonly code: HouseAccountEmailManagementErrorCode, message: string) {
    super(message);
    this.name = "HouseAccountEmailManagementError";
  }
}

export function houseAccountEmailManagementMessage(code: HouseAccountEmailManagementErrorCode): string {
  switch (code) {
    case "UNAUTHORIZED": return "กรุณาเข้าสู่ระบบอีกครั้ง";
    case "FORBIDDEN": return "บัญชีนี้ไม่สามารถจัดการอีเมลของบัญชีบ้านได้";
    case "ACCOUNT_UNAVAILABLE": return "บัญชีบ้านไม่พร้อมใช้งาน";
    case "FLOW_NOT_FOUND": return "ไม่พบขั้นตอนการเพิ่มอีเมล กรุณาเริ่มใหม่";
    case "FLOW_EXPIRED": return "ขั้นตอนการเพิ่มอีเมลหมดอายุ กรุณาเริ่มใหม่";
    case "EMAIL_ALREADY_ACTIVE": return "อีเมลนี้ถูกเพิ่มในบัญชีบ้านแล้ว";
    case "EMAIL_UNAVAILABLE": return "อีเมลนี้ไม่สามารถเพิ่มในบัญชีนี้ได้";
    case "MAX_ACTIVE_EMAILS": return "บัญชีบ้านสามารถมีอีเมลสำหรับเข้าสู่ระบบได้สูงสุด 10 อีเมล";
    case "INVALID_EMAIL": return "กรุณากรอกอีเมลให้ถูกต้อง";
    case "INVALID_CODE": return "รหัสยืนยันไม่ถูกต้อง";
    case "OTP_UNAVAILABLE": return "รหัสยืนยันไม่พร้อมใช้งานหรือหมดอายุ";
    case "RATE_LIMITED": return "ส่งรหัสบ่อยเกินไป กรุณารอสักครู่";
    case "DELIVERY_FAILED": return "ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่";
    case "EMAIL_NOT_FOUND": return "ไม่พบอีเมลที่ต้องการจัดการ";
    case "LAST_ACTIVE_EMAIL": return "ไม่สามารถนำอีเมลสุดท้ายออกได้";
  }
}

export type HouseEmailContext = {
  authSessionId: string;
  userId: string;
  residentHouseAccountId: string;
  villageId: string;
  houseId: string;
};

type ManagementDb = Pick<
  Prisma.TransactionClient,
  "residentHouseAccount" | "villageMembership" | "authSession"
>;

async function loadEligibleContext(db: ManagementDb, session: SessionContext): Promise<HouseEmailContext> {
  if (session.accountKind !== "RESIDENT_HOUSE") {
    throw new HouseAccountEmailManagementError("FORBIDDEN", houseAccountEmailManagementMessage("FORBIDDEN"));
  }
  const configuredVillage = await getConfiguredVillage();
  const [houseAccount, membership, authSession] = await Promise.all([
    db.residentHouseAccount.findUnique({
      where: { userId: session.id },
      select: { id: true, userId: true, villageId: true, houseId: true, activatedAt: true, suspendedAt: true },
    }),
    db.villageMembership.findFirst({
      where: {
        userId: session.id,
        villageId: configuredVillage.id,
        role: "RESIDENT",
        status: "ACTIVE",
        houseId: { not: null },
      },
      select: { houseId: true },
    }),
    db.authSession.findFirst({
      where: { id: session.authSessionId, userId: session.id, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  if (!authSession) {
    throw new HouseAccountEmailManagementError("UNAUTHORIZED", houseAccountEmailManagementMessage("UNAUTHORIZED"));
  }
  if (
    !houseAccount
    || !houseAccount.activatedAt
    || houseAccount.suspendedAt
    || houseAccount.villageId !== configuredVillage.id
    || !membership?.houseId
    || membership.houseId !== houseAccount.houseId
  ) {
    throw new HouseAccountEmailManagementError("ACCOUNT_UNAVAILABLE", houseAccountEmailManagementMessage("ACCOUNT_UNAVAILABLE"));
  }
  return {
    authSessionId: authSession.id,
    userId: session.id,
    residentHouseAccountId: houseAccount.id,
    villageId: houseAccount.villageId,
    houseId: houseAccount.houseId,
  };
}

export function assertOwnedFlow(flow: HouseAccountEmailFlow | null, context: HouseEmailContext): HouseAccountEmailFlow {
  if (
    !flow
    || flow.authSessionId !== context.authSessionId
    || flow.userId !== context.userId
    || flow.residentHouseAccountId !== context.residentHouseAccountId
  ) {
    throw new HouseAccountEmailManagementError("FLOW_NOT_FOUND", houseAccountEmailManagementMessage("FLOW_NOT_FOUND"));
  }
  return flow;
}

function mapServiceError(error: unknown): HouseAccountEmailManagementError {
  if (error instanceof HouseAccountEmailManagementError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new HouseAccountEmailManagementError("EMAIL_UNAVAILABLE", houseAccountEmailManagementMessage("EMAIL_UNAVAILABLE"));
  }
  if (error instanceof AccountEmailServiceError) {
    const code: HouseAccountEmailManagementErrorCode = error.code === "EMAIL_ALREADY_ACTIVE"
      ? "EMAIL_ALREADY_ACTIVE"
      : error.code === "MAX_ACTIVE_EMAILS"
        ? "MAX_ACTIVE_EMAILS"
        : error.code === "INVALID_EMAIL"
          ? "INVALID_EMAIL"
          : error.code === "LAST_ACTIVE_EMAIL"
            ? "LAST_ACTIVE_EMAIL"
            : error.code === "ACCOUNT_EMAIL_NOT_FOUND"
              ? "EMAIL_NOT_FOUND"
              : "EMAIL_UNAVAILABLE";
    return new HouseAccountEmailManagementError(code, houseAccountEmailManagementMessage(code));
  }
  if (error instanceof EmailOtpServiceError) {
    const code: HouseAccountEmailManagementErrorCode = error.code === "INVALID_CODE"
      ? "INVALID_CODE"
      : error.code === "RATE_LIMITED" || error.code === "RESEND_COOLDOWN" || error.code === "MAX_RESENDS"
        ? "RATE_LIMITED"
        : error.code === "DELIVERY_FAILED"
          ? "DELIVERY_FAILED"
          : "OTP_UNAVAILABLE";
    return new HouseAccountEmailManagementError(code, houseAccountEmailManagementMessage(code));
  }
  return new HouseAccountEmailManagementError("ACCOUNT_UNAVAILABLE", houseAccountEmailManagementMessage("ACCOUNT_UNAVAILABLE"));
}

export async function requireHouseAccountEmailContext(session: SessionContext): Promise<HouseEmailContext> {
  return loadEligibleContext(prisma, session);
}

export async function startHouseAccountEmailAddition(
  session: SessionContext,
  email: string,
  clientContext: EmailOtpClientContext,
) {
  const context = await requireHouseAccountEmailContext(session);
  let reserved;
  try {
    reserved = await prisma.$transaction(async (tx) => {
      await loadEligibleContext(tx, session);
      return reserveEmailForHouseAccountInTransaction(tx, {
        userId: context.userId,
        residentHouseAccountId: context.residentHouseAccountId,
        email,
        maxActiveEmails: MAX_HOUSE_ACCOUNT_EMAILS,
      });
    });
    const now = new Date();
    const activeChallenge = reserved.resumed
      ? await prisma.emailOtpChallenge.findFirst({
          where: {
            accountEmailId: reserved.accountEmail.id,
            userId: context.userId,
            purpose: "ADD_HOUSE_EMAIL",
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
        })
      : null;
    if (activeChallenge?.resendAvailableAt) {
      return {
        context,
        accountEmail: reserved.accountEmail,
        challengeId: activeChallenge.id,
        expiresAt: activeChallenge.expiresAt,
        resendAvailableAt: activeChallenge.resendAvailableAt,
      };
    }
    const config = readEmailOtpConfig();
    const rateWindowStart = new Date(now.getTime() - config.rateWindowSeconds * 1_000);
    const houseStarts = await prisma.emailOtpChallenge.count({
      where: { userId: context.userId, purpose: "ADD_HOUSE_EMAIL", createdAt: { gte: rateWindowStart } },
    });
    if (houseStarts >= config.maxRequestsPerEmail) {
      throw new HouseAccountEmailManagementError("RATE_LIMITED", houseAccountEmailManagementMessage("RATE_LIMITED"));
    }
    const challenge = await issueEmailOtpChallenge({
      email: reserved.accountEmail.email,
      purpose: "ADD_HOUSE_EMAIL",
      accountEmailId: reserved.accountEmail.id,
      userId: context.userId,
      context: clientContext,
    });
    return { context, accountEmail: reserved.accountEmail, ...challenge };
  } catch (error) {
    if (reserved) {
      await cleanupPendingEmail(context, reserved.accountEmail.id).catch(() => undefined);
    }
    throw mapServiceError(error);
  }
}

async function cleanupPendingEmail(context: HouseEmailContext, accountEmailId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.emailOtpChallenge.updateMany({
      where: {
        accountEmailId,
        userId: context.userId,
        purpose: "ADD_HOUSE_EMAIL",
        status: { in: ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] },
      },
      data: { status: "CANCELLED" },
    });
    const pending = await tx.accountEmail.findFirst({
      where: {
        id: accountEmailId,
        userId: context.userId,
        residentHouseAccountId: context.residentHouseAccountId,
        status: "PENDING_VERIFICATION",
        source: "HOUSE_ACCOUNT",
      },
      select: { id: true },
    });
    if (pending) {
      await releasePendingHouseAccountEmailInTransaction(tx, {
        accountEmailId,
        userId: context.userId,
        residentHouseAccountId: context.residentHouseAccountId,
      });
    }
  });
}

export async function resendHouseAccountEmailAddition(
  session: SessionContext,
  flow: HouseAccountEmailFlow | null,
  clientContext: EmailOtpClientContext,
) {
  const context = await requireHouseAccountEmailContext(session);
  const ownedFlow = assertOwnedFlow(flow, context);
  const alias = await prisma.accountEmail.findFirst({
    where: {
      id: ownedFlow.accountEmailId,
      userId: context.userId,
      residentHouseAccountId: context.residentHouseAccountId,
      source: "HOUSE_ACCOUNT",
      status: "PENDING_VERIFICATION",
    },
  });
  if (!alias || ownedFlow.challengeId !== flow?.challengeId) {
    throw new HouseAccountEmailManagementError("FLOW_NOT_FOUND", houseAccountEmailManagementMessage("FLOW_NOT_FOUND"));
  }
  try {
    const challenge = await resendEmailOtpChallenge({
      challengeId: ownedFlow.challengeId,
      email: alias.email,
      context: clientContext,
    });
    return { context, accountEmail: alias, ...challenge };
  } catch (error) {
    if (error instanceof EmailOtpServiceError && error.code === "DELIVERY_FAILED") {
      await cleanupPendingEmail(context, alias.id).catch(() => undefined);
    }
    throw mapServiceError(error);
  }
}

export async function verifyHouseAccountEmailAddition(
  session: SessionContext,
  flow: HouseAccountEmailFlow | null,
  code: string,
) {
  const context = await requireHouseAccountEmailContext(session);
  const ownedFlow = assertOwnedFlow(flow, context);
  try {
    const verified = await verifyEmailOtpChallenge({ challengeId: ownedFlow.challengeId, code });
    if (
      verified.purpose !== "ADD_HOUSE_EMAIL"
      || verified.userId !== context.userId
      || verified.accountEmailId !== ownedFlow.accountEmailId
    ) throw new HouseAccountEmailManagementError("OTP_UNAVAILABLE", houseAccountEmailManagementMessage("OTP_UNAVAILABLE"));

    return await consumeVerifiedEmailOtpChallenge(ownedFlow.challengeId, {
      apply: async (tx, challenge) => {
        const current = await loadEligibleContext(tx, session);
        assertOwnedFlow(ownedFlow, current);
        if (
          challenge.purpose !== "ADD_HOUSE_EMAIL"
          || challenge.userId !== current.userId
          || challenge.accountEmailId !== ownedFlow.accountEmailId
        ) throw new HouseAccountEmailManagementError("OTP_UNAVAILABLE", houseAccountEmailManagementMessage("OTP_UNAVAILABLE"));
        const alias = await tx.accountEmail.findFirst({
          where: {
            id: ownedFlow.accountEmailId,
            userId: current.userId,
            residentHouseAccountId: current.residentHouseAccountId,
            source: "HOUSE_ACCOUNT",
            status: "PENDING_VERIFICATION",
          },
        });
        if (!alias || alias.normalizedEmail !== challenge.normalizedEmail) {
          throw new HouseAccountEmailManagementError("EMAIL_NOT_FOUND", houseAccountEmailManagementMessage("EMAIL_NOT_FOUND"));
        }
        await lockAccountEmailOwnerNamespace(tx, current.residentHouseAccountId);
        const activeCount = await tx.accountEmail.count({
          where: { residentHouseAccountId: current.residentHouseAccountId, status: "ACTIVE" },
        });
        if (activeCount >= MAX_HOUSE_ACCOUNT_EMAILS) {
          throw new HouseAccountEmailManagementError("MAX_ACTIVE_EMAILS", houseAccountEmailManagementMessage("MAX_ACTIVE_EMAILS"));
        }
        const active = await activateAccountEmailInTransaction(tx, {
          accountEmailId: alias.id,
          userId: current.userId,
          residentHouseAccountId: current.residentHouseAccountId,
          verifiedAt: challenge.verifiedAt,
          activatedAt: challenge.verifiedAt,
        });
        await writeVillageAuditLog(tx, {
          villageId: current.villageId,
          userId: current.userId,
          actorAuthSessionId: current.authSessionId,
          action: AuditAction.CREATE,
          resource: "AccountEmail",
          resourceId: active.id,
          metadata: {
            actionName: "HOUSE_ACCOUNT_EMAIL_ADDED",
            accountEmailId: active.id,
            maskedEmail: maskEmail(active.email),
          },
        });
        return { id: active.id, email: active.email };
      },
    });
  } catch (error) {
    throw mapServiceError(error);
  }
}

export async function cancelHouseAccountEmailAddition(
  session: SessionContext,
  flow: HouseAccountEmailFlow | null,
): Promise<void> {
  const context = await requireHouseAccountEmailContext(session);
  const ownedFlow = assertOwnedFlow(flow, context);
  await cleanupPendingEmail(context, ownedFlow.accountEmailId);
}

export async function removeHouseAccountEmail(
  session: SessionContext,
  accountEmailId: string,
) {
  await requireHouseAccountEmailContext(session);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await loadEligibleContext(tx, session);
      await lockAccountEmailOwnerNamespace(tx, current.residentHouseAccountId);
      const target = await tx.accountEmail.findFirst({
        where: {
          id: accountEmailId,
          userId: current.userId,
          residentHouseAccountId: current.residentHouseAccountId,
          source: "HOUSE_ACCOUNT",
          status: "ACTIVE",
        },
      });
      if (!target) throw new HouseAccountEmailManagementError("EMAIL_NOT_FOUND", houseAccountEmailManagementMessage("EMAIL_NOT_FOUND"));
      const activeEmails = await tx.accountEmail.findMany({
        where: { residentHouseAccountId: current.residentHouseAccountId, status: "ACTIVE" },
        orderBy: [{ activatedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
      if (!canRemoveAccountEmail(activeEmails.length)) {
        throw new HouseAccountEmailManagementError("LAST_ACTIVE_EMAIL", houseAccountEmailManagementMessage("LAST_ACTIVE_EMAIL"));
      }
      const remaining = activeEmails.filter((email) => email.id !== target.id);
      const user = await tx.user.findUnique({ where: { id: current.userId }, select: { id: true, email: true } });
      if (!user) throw new HouseAccountEmailManagementError("ACCOUNT_UNAVAILABLE", houseAccountEmailManagementMessage("ACCOUNT_UNAVAILABLE"));
      let canonicalEmailRotated = false;
      if (user.email && normalizeAccountEmail(user.email) === target.normalizedEmail) {
        const replacement = chooseCanonicalReplacement(remaining);
        if (!replacement) throw new HouseAccountEmailManagementError("LAST_ACTIVE_EMAIL", houseAccountEmailManagementMessage("LAST_ACTIVE_EMAIL"));
        await tx.user.update({ where: { id: user.id }, data: { email: replacement.email, emailVerified: true } });
        canonicalEmailRotated = true;
      }
      await tx.accountEmail.update({
        where: { id: target.id },
        data: { status: "REVOKED", userId: null, residentHouseAccountId: null, revokedAt: new Date() },
      });
      await writeVillageAuditLog(tx, {
        villageId: current.villageId,
        userId: current.userId,
        actorAuthSessionId: current.authSessionId,
        action: AuditAction.DELETE,
        resource: "AccountEmail",
        resourceId: target.id,
        metadata: {
          actionName: "HOUSE_ACCOUNT_EMAIL_REMOVED",
          accountEmailId: target.id,
          maskedEmail: maskEmail(target.email),
        },
      });
      const revokedSessionCount = await revokeSessionsForAccountEmail(target.id, tx);
      return {
        currentSessionRevoked: session.loginAccountEmailId === target.id,
        canonicalEmailRotated,
        revokedSessionCount,
      };
    });
  } catch (error) {
    throw mapServiceError(error);
  }
}
