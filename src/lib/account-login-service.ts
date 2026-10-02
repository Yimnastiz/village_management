import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { maskEmail, normalizeAccountEmail } from "@/lib/account-email";
import { readAccountLoginFlowCookie, verifyAccountLoginFlowToken, ACCOUNT_LOGIN_FLOW_TTL_SECONDS } from "@/lib/account-login-access";
import { resolveLoginEmail, type AccountLoginIdentity } from "@/lib/account-login-resolver";
import { sanitizeAdminCallbackUrl, sanitizeInternalCallbackUrl, sanitizeResidentCallbackUrl } from "@/lib/callback-url";
import { getConfiguredVillage } from "@/lib/configured-village";
import { hashEmailOtpAbuseContext } from "@/lib/email/email-otp-crypto";
import { readEmailOtpConfig } from "@/lib/email/email-otp-config";
import { consumeVerifiedEmailOtpChallenge, issueEmailOtpChallenge, resendEmailOtpChallenge, verifyEmailOtpChallenge, type EmailOtpClientContext } from "@/lib/email/email-otp-service";
import { prisma } from "@/lib/prisma";

export type AccountLoginErrorCode = "FLOW_NOT_FOUND" | "FLOW_EXPIRED" | "INVALID_CODE" | "OTP_UNAVAILABLE" | "ACCOUNT_UNAVAILABLE" | "RATE_LIMITED" | "INVALID_EMAIL";
export class AccountLoginError extends Error {
  constructor(readonly code: AccountLoginErrorCode, message: string) { super(message); this.name = "AccountLoginError"; }
}

type PublicFlow = { flowId: string; maskedEmail: string; expiresAt: Date; resendAvailableAt: Date };
type VerifiedLoginIdentity = AccountLoginIdentity & { callbackUrl: string; challengeId: string };
type LoginDb = Pick<Prisma.TransactionClient, "authSession" | "auditLog" | "accountLoginFlow">;

function flowFromRow(flow: { id: string; maskedEmail: string; expiresAt: Date; resendAvailableAt: Date }): PublicFlow {
  return { flowId: flow.id, maskedEmail: flow.maskedEmail, expiresAt: flow.expiresAt, resendAvailableAt: flow.resendAvailableAt };
}
function requestIp(context: EmailOtpClientContext): string | null { return context.ipAddress?.split(",")[0]?.trim() || null; }
function landingPath(identity: AccountLoginIdentity, callbackUrl: string | null): string {
  return identity.accountKind === "HEADMAN"
    ? sanitizeAdminCallbackUrl(callbackUrl, "/admin/dashboard") ?? "/admin/dashboard"
    : sanitizeResidentCallbackUrl(callbackUrl, "/resident/dashboard") ?? "/resident/dashboard";
}

export async function startAccountLogin(input: { email: string; callbackUrl?: string | null }, context: EmailOtpClientContext): Promise<PublicFlow> {
  const normalizedEmail = normalizeAccountEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 320) throw new AccountLoginError("INVALID_EMAIL", "A valid email address is required.");
  const config = readEmailOtpConfig();
  const now = new Date();
  const ipHash = hashEmailOtpAbuseContext(requestIp(context), config.hashSecret);
  const emailHash = hashEmailOtpAbuseContext(normalizedEmail, config.hashSecret);
  const rateWindowStart = new Date(now.getTime() - config.rateWindowSeconds * 1_000);
  const [ipAttempts, emailAttempts] = await Promise.all([
    ipHash ? prisma.accountLoginFlow.count({ where: { ipHash, createdAt: { gte: rateWindowStart } } }) : Promise.resolve(0),
    prisma.accountLoginFlow.count({ where: { emailHash, createdAt: { gte: rateWindowStart } } }),
  ]);
  if (ipAttempts >= config.maxRequestsPerIp || emailAttempts >= config.maxRequestsPerEmail) throw new AccountLoginError("RATE_LIMITED", "Login request limit reached.");

  const fallbackExpiresAt = new Date(now.getTime() + ACCOUNT_LOGIN_FLOW_TTL_SECONDS * 1_000);
  const flow = await prisma.accountLoginFlow.create({ data: { id: randomUUID(), callbackUrl: sanitizeInternalCallbackUrl(input.callbackUrl), maskedEmail: maskEmail(normalizedEmail), ipHash, emailHash, expiresAt: fallbackExpiresAt, resendAvailableAt: new Date(now.getTime() + config.resendSeconds * 1_000) } });
  const resolution = await resolveLoginEmail(normalizedEmail);
  if (resolution.kind !== "RESOLVED") return flowFromRow(flow);
  const identity = resolution.identity;
  try {
    const challenge = await issueEmailOtpChallenge({ email: identity.email, purpose: identity.accountKind === "HEADMAN" ? "HEADMAN_LOGIN" : "HOUSE_LOGIN", accountEmailId: identity.accountEmailId, userId: identity.userId, context });
    const updated = await prisma.accountLoginFlow.update({ where: { id: flow.id }, data: { challengeId: challenge.challengeId, accountEmailId: identity.accountEmailId, expiresAt: challenge.expiresAt, resendAvailableAt: challenge.resendAvailableAt } });
    return flowFromRow(updated);
  } catch (error) {
    console.error("[account-login] OTP was not issued", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return flowFromRow(flow);
  }
}

function flowIdFromHeaders(headers: Headers): string | null { return verifyAccountLoginFlowToken(readAccountLoginFlowCookie(headers.get("cookie")))?.flowId ?? null; }
async function loadOwnedFlow(headers: Headers, claimedFlowId?: string | null) {
  const flowId = flowIdFromHeaders(headers);
  if (!flowId || (claimedFlowId && claimedFlowId !== flowId)) throw new AccountLoginError("FLOW_NOT_FOUND", "Login flow was not found.");
  const flow = await prisma.accountLoginFlow.findUnique({ where: { id: flowId } });
  if (!flow || flow.cancelledAt || flow.completedAt) throw new AccountLoginError("FLOW_NOT_FOUND", "Login flow was not found.");
  if (flow.expiresAt <= new Date()) throw new AccountLoginError("FLOW_EXPIRED", "Login flow has expired.");
  return flow;
}

export async function getAccountLoginStatus(headers: Headers): Promise<PublicFlow> { return flowFromRow(await loadOwnedFlow(headers)); }

export async function resendAccountLoginOtp(headers: Headers, claimedFlowId: string, context: EmailOtpClientContext): Promise<PublicFlow> {
  const flow = await loadOwnedFlow(headers, claimedFlowId);
  if (!flow.challengeId) return flowFromRow(flow);
  const challengeRow = await prisma.emailOtpChallenge.findUnique({ where: { id: flow.challengeId }, select: { normalizedEmail: true, userId: true, accountEmailId: true } });
  if (!challengeRow) return flowFromRow(flow);
  const resolution = await resolveLoginEmail(challengeRow.normalizedEmail);
  if (resolution.kind !== "RESOLVED" || resolution.identity.userId !== challengeRow.userId || resolution.identity.accountEmailId !== challengeRow.accountEmailId) return flowFromRow(flow);
  try {
    const challenge = await resendEmailOtpChallenge({ challengeId: flow.challengeId, email: resolution.identity.email, context });
    return flowFromRow(await prisma.accountLoginFlow.update({ where: { id: flow.id }, data: { expiresAt: challenge.expiresAt, resendAvailableAt: challenge.resendAvailableAt } }));
  } catch { return flowFromRow(flow); }
}

export async function cancelAccountLogin(headers: Headers, claimedFlowId?: string | null): Promise<void> {
  const flow = await loadOwnedFlow(headers, claimedFlowId);
  await prisma.$transaction(async (tx) => {
    await tx.accountLoginFlow.update({ where: { id: flow.id }, data: { cancelledAt: new Date() } });
    if (flow.challengeId) await tx.emailOtpChallenge.updateMany({ where: { id: flow.challengeId, purpose: { in: ["HOUSE_LOGIN", "HEADMAN_LOGIN"] }, status: { in: ["PENDING_DELIVERY", "ACTIVE", "VERIFIED"] } }, data: { status: "CANCELLED" } });
  });
}

export async function verifyAccountLoginOtp(headers: Headers, input: { flowId: string; code: string }): Promise<VerifiedLoginIdentity> {
  const flow = await loadOwnedFlow(headers, input.flowId);
  if (!flow.challengeId) throw new AccountLoginError("INVALID_CODE", "Unable to verify the login code.");
  let verified;
  try { verified = await verifyEmailOtpChallenge({ challengeId: flow.challengeId, code: input.code }); }
  catch { throw new AccountLoginError("INVALID_CODE", "Unable to verify the login code."); }
  if (!verified.userId || !["HOUSE_LOGIN", "HEADMAN_LOGIN"].includes(verified.purpose)) throw new AccountLoginError("OTP_UNAVAILABLE", "Unable to verify the login code.");
  const resolution = await resolveLoginEmail(verified.normalizedEmail);
  if (resolution.kind !== "RESOLVED" || resolution.identity.userId !== verified.userId || resolution.identity.accountEmailId !== verified.accountEmailId || (resolution.identity.accountKind === "HEADMAN") !== (verified.purpose === "HEADMAN_LOGIN")) {
    await prisma.emailOtpChallenge.updateMany({ where: { id: flow.challengeId, status: "VERIFIED" }, data: { status: "CANCELLED" } });
    throw new AccountLoginError("ACCOUNT_UNAVAILABLE", "Account is unavailable.");
  }
  return { ...resolution.identity, challengeId: flow.challengeId, callbackUrl: landingPath(resolution.identity, flow.callbackUrl) };
}

export async function consumeAccountLoginOtp(input: { flowId: string; challengeId: string; sessionId: string; sessionToken: string; identity: VerifiedLoginIdentity }): Promise<void> {
  const configuredVillageId = (await getConfiguredVillage()).id;
  await consumeVerifiedEmailOtpChallenge(input.challengeId, { apply: async (tx, challenge) => {
    const db = tx as typeof tx & LoginDb;
    const flow = await db.accountLoginFlow.findUnique({ where: { id: input.flowId } });
    if (!flow || flow.completedAt || flow.cancelledAt || flow.challengeId !== challenge.challengeId || challenge.userId !== input.identity.userId || challenge.accountEmailId !== input.identity.accountEmailId) throw new AccountLoginError("OTP_UNAVAILABLE", "Login challenge is unavailable.");
    const resolution = await resolveLoginEmail(challenge.normalizedEmail, { db: tx, configuredVillageId });
    if (resolution.kind !== "RESOLVED" || resolution.identity.userId !== input.identity.userId || resolution.identity.accountKind !== input.identity.accountKind) throw new AccountLoginError("ACCOUNT_UNAVAILABLE", "Account is unavailable.");
    const attributed = await db.authSession.updateMany({ where: { id: input.sessionId, token: input.sessionToken, userId: input.identity.userId }, data: { activeVillageId: input.identity.villageId, loginAccountEmailId: input.identity.accountEmailId } });
    if (attributed.count !== 1) throw new AccountLoginError("ACCOUNT_UNAVAILABLE", "Session attribution failed.");
    await db.accountLoginFlow.update({ where: { id: flow.id }, data: { completedAt: new Date() } });
    await db.auditLog.create({ data: { villageId: input.identity.villageId, userId: input.identity.userId, action: "LOGIN", resource: "AuthSession", resourceId: input.sessionId, metadata: { actorRole: input.identity.accountKind === "HEADMAN" ? "HEADMAN" : "RESIDENT", accountKind: input.identity.accountKind, actionName: "ACCOUNT_EMAIL_LOGIN_SUCCEEDED", ...(input.identity.houseId ? { houseId: input.identity.houseId, houseNumber: input.identity.houseNumber } : {}), ...(input.identity.accountEmailId ? { loginAccountEmailId: input.identity.accountEmailId } : {}), maskedEmail: maskEmail(input.identity.email) } } });
  } });
}

export async function revokeSessionsForAccountEmail(accountEmailId: string, db: Pick<Prisma.TransactionClient, "authSession"> = prisma): Promise<number> {
  return (await db.authSession.deleteMany({ where: { loginAccountEmailId: accountEmailId } })).count;
}
