import { AccountStatus, LoginOtpChallengeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveAuthRedirectPathFromRequest } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { writeVillageAuditLog } from "@/lib/audit-log";
import { SESSION_COOKIE_NAMES } from "@/lib/session-cookie";
import {
  LOGIN_OTP_COOKIE,
  LOGIN_OTP_LOCK_MS,
  LOGIN_OTP_MAX_FAILED,
  loadLoginChallenge,
  publicLoginChallengeState,
  retryAfterSeconds,
  withLoginPhoneLock,
} from "@/lib/login-otp-challenge";

function developmentDiagnostic(values: Record<string, boolean>) {
  if (process.env.NODE_ENV === "development") console.log("[auth] sign-in OTP verify", values);
}

export async function POST(request: NextRequest) {
  const landingPath = await getActiveAuthRedirectPathFromRequest(request);
  if (landingPath) {
    return NextResponse.json(
      {
        error: "Already signed in. Please log out before signing in with another account.",
        landingPath,
      },
      { status: 409 }
    );
  }

  const loaded = await loadLoginChallenge(request);
  if (!loaded) {
    developmentDiagnostic({ challengeFound: false, otpMatched: false, userFound: false, sessionCreated: false, cookieAttached: false });
    return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Invalid OTP payload." }, { status: 400 });

  const now = new Date();
  const reservation = await withLoginPhoneLock(loaded.phoneNumber, async (tx) => {
    const challenge = await tx.loginOtpChallenge.findUnique({ where: { phoneNumber: loaded.phoneNumber } });
    if (!challenge || challenge.challengeToken !== loaded.challengeToken) return { allowed: false as const, status: 404, reason: "missing", challenge: null };
    if (challenge.lockedUntil && challenge.lockedUntil > now) return { allowed: false as const, status: 429, reason: "locked", challenge };
    if (challenge.status === LoginOtpChallengeStatus.VERIFYING && now.getTime() - challenge.updatedAt.getTime() < 30_000) {
      return { allowed: false as const, status: 409, reason: "in-flight", challenge };
    }
    if ((challenge.status !== LoginOtpChallengeStatus.ACTIVE && challenge.status !== LoginOtpChallengeStatus.VERIFYING) || !challenge.otpExpiresAt) {
      return { allowed: false as const, status: 410, reason: "inactive", challenge };
    }
    if (challenge.otpExpiresAt <= now) return { allowed: false as const, status: 410, reason: "expired", challenge };

    const verification = await tx.authVerification.findFirst({
      where: { identifier: challenge.otpIdentifier, expiresAt: { gt: now } },
      orderBy: { updatedAt: "desc" },
    });
    if (!verification) return { allowed: false as const, status: 410, reason: "expired", challenge };
    const user = await tx.user.findFirst({
      where: { phoneNumber: { in: [challenge.otpIdentifier, loaded.phoneNumber] } },
      select: {
        accountStatus: true,
        duplicateNoticeLoginUsedAt: true,
        duplicateNoticeSeenAt: true,
      },
    });
    const canSignIn = user?.accountStatus === AccountStatus.ACTIVE || (
      user?.accountStatus === AccountStatus.DUPLICATE_ID &&
      !user.duplicateNoticeSeenAt &&
      !user.duplicateNoticeLoginUsedAt
    );
    if (!canSignIn) return { allowed: false as const, status: 403, reason: "duplicate-disabled", challenge };
    const separator = verification.value.lastIndexOf(":");
    const storedCode = separator >= 0 ? verification.value.slice(0, separator) : verification.value;
    const storedAttempts = separator >= 0 ? Number.parseInt(verification.value.slice(separator + 1), 10) || 0 : 0;

    if (storedCode !== code) {
      const failedAttempts = Math.min(LOGIN_OTP_MAX_FAILED, challenge.failedAttempts + 1);
      const lockedUntil = failedAttempts >= LOGIN_OTP_MAX_FAILED ? new Date(now.getTime() + LOGIN_OTP_LOCK_MS) : null;
      const updated = await tx.loginOtpChallenge.update({
        where: { id: challenge.id },
        data: { failedAttempts, lockedUntil, status: lockedUntil ? LoginOtpChallengeStatus.LOCKED : LoginOtpChallengeStatus.ACTIVE },
      });
      if (lockedUntil) await tx.authVerification.deleteMany({ where: { identifier: challenge.otpIdentifier } });
      else await tx.authVerification.update({ where: { id: verification.id }, data: { value: `${storedCode}:${storedAttempts + 1}` } });
      return { allowed: false as const, status: lockedUntil ? 429 : 401, reason: lockedUntil ? "locked-after-failure" : "invalid", challenge: updated };
    }

    const reserved = await tx.loginOtpChallenge.update({ where: { id: challenge.id }, data: { status: LoginOtpChallengeStatus.VERIFYING } });
    return { allowed: true as const, challenge: reserved, verification };
  });

  if (!reservation.allowed) {
    const retry = reservation.challenge?.lockedUntil ? retryAfterSeconds(reservation.challenge.lockedUntil, now) : undefined;
    const error = reservation.reason === "locked" || reservation.reason === "locked-after-failure"
      ? "กรอก OTP ผิดครบ 5 ครั้ง ระบบถูกล็อกชั่วคราว 15 นาที"
      : reservation.reason === "invalid"
        ? `OTP ไม่ถูกต้อง เหลือโอกาสอีก ${reservation.challenge ? LOGIN_OTP_MAX_FAILED - reservation.challenge.failedAttempts : 0} ครั้ง`
        : reservation.reason === "in-flight"
          ? "OTP verification is already in progress."
          : reservation.reason === "missing"
            ? "Login OTP challenge not found."
            : reservation.reason === "duplicate-disabled"
              ? "บัญชีนี้ไม่สามารถใช้งานได้ เนื่องจากเลขบัตรประชาชนถูกใช้กับบัญชีที่ผูกบ้านแล้ว กรุณาสมัครใหม่"
            : "OTP has expired. Please request a new code.";
    developmentDiagnostic({ challengeFound: Boolean(reservation.challenge), otpMatched: false, userFound: false, sessionCreated: false, cookieAttached: false });
    return NextResponse.json({ error, retryAfterSeconds: retry, data: reservation.challenge ? publicLoginChallengeState(reservation.challenge) : undefined }, {
      status: reservation.status,
      headers: retry ? { "Retry-After": String(retry) } : undefined,
    });
  }

  let createdSessionToken: string | null = null;
  try {
    const result = await auth.api.verifyPhoneNumber({
      body: { phoneNumber: reservation.challenge.otpIdentifier, code },
      headers: request.headers,
      returnHeaders: true,
    });
    const payload = result.response as { status?: boolean; token?: string; user?: { id?: string } };
    createdSessionToken = payload.token ?? null;
    const setCookies = result.headers.getSetCookie();
    const sessionCookieAttached = setCookies.some((cookie) => SESSION_COOKIE_NAMES.some((name) => cookie.startsWith(`${name}=`)));
    const session = payload.token ? await prisma.authSession.findUnique({ where: { token: payload.token }, select: { id: true } }) : null;
    const loginSucceeded = payload.status === true && Boolean(payload.user?.id) && Boolean(session) && sessionCookieAttached;

    if (!loginSucceeded) throw new Error("Better Auth did not return a complete login response.");

    const response = NextResponse.json({ ok: true, login: true });
    // NextResponse.cookies.delete rewrites Set-Cookie. Delete the challenge first,
    // then append Better Auth cookies so the session cookie cannot be discarded.
    response.cookies.delete(LOGIN_OTP_COOKIE);
    for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
    const cookieReady = response.headers.getSetCookie().some((cookie) => SESSION_COOKIE_NAMES.some((name) => cookie.startsWith(`${name}=`)));
    if (!cookieReady) throw new Error("Session cookie was not attached to the response.");

    await withLoginPhoneLock(loaded.phoneNumber, async (tx) => {
      if (payload.user?.id) {
        await tx.user.updateMany({
          where: {
            id: payload.user.id,
            accountStatus: AccountStatus.DUPLICATE_ID,
            duplicateNoticeSeenAt: null,
            duplicateNoticeLoginUsedAt: null,
          },
          data: { duplicateNoticeLoginUsedAt: new Date() },
        });
      }
      await tx.loginOtpChallenge.update({
        where: { id: reservation.challenge.id },
        data: { status: LoginOtpChallengeStatus.CONSUMED, otpExpiresAt: null, resendAvailableAt: null },
      });
      await tx.authVerification.deleteMany({ where: { identifier: reservation.challenge.otpIdentifier } });
    });
    // Only record a successful sign-in for an administrator's active village.
    // Failed OTP attempts remain intentionally out of the village activity feed.
    const adminMembership = await prisma.villageMembership.findFirst({
      where: { userId: payload.user!.id!, status: "ACTIVE", role: { in: ["HEADMAN", "ASSISTANT_HEADMAN"] } },
      select: { villageId: true },
    });
    if (adminMembership) await writeVillageAuditLog(prisma, { villageId: adminMembership.villageId, userId: payload.user!.id!, action: "LOGIN", resource: "AuthSession", resourceId: session!.id });
    developmentDiagnostic({ challengeFound: true, otpMatched: true, userFound: true, sessionCreated: true, cookieAttached: true });
    return response;
  } catch (error) {
    if (createdSessionToken) await prisma.authSession.deleteMany({ where: { token: createdSessionToken } });
    await withLoginPhoneLock(loaded.phoneNumber, async (tx) => {
      await tx.loginOtpChallenge.updateMany({
        where: { id: reservation.challenge.id, status: LoginOtpChallengeStatus.VERIFYING },
        data: { status: LoginOtpChallengeStatus.ACTIVE },
      });
      const activeVerification = await tx.authVerification.findFirst({ where: { identifier: reservation.challenge.otpIdentifier } });
      if (!activeVerification && reservation.verification.expiresAt > new Date()) {
        await tx.authVerification.create({
          data: {
            identifier: reservation.verification.identifier,
            value: reservation.verification.value,
            expiresAt: reservation.verification.expiresAt,
          },
        });
      }
    });
    if (process.env.NODE_ENV === "development") {
      console.error("[auth] sign-in session creation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    }
    developmentDiagnostic({ challengeFound: true, otpMatched: true, userFound: true, sessionCreated: false, cookieAttached: false });
    return NextResponse.json({ error: "Unable to complete sign in." }, { status: 500 });
  }
}
