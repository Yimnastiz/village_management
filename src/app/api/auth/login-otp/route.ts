import { AccountStatus, LoginOtpChallengeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveAuthRedirectPathFromRequest } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import {
  LOGIN_OTP_MAX_SENDS_PER_WINDOW,
  LOGIN_OTP_IN_FLIGHT_MS,
  LOGIN_OTP_RESEND_COOLDOWN_MS,
  LOGIN_OTP_SEND_WINDOW_MS,
  LOGIN_OTP_TTL_MS,
  loadLoginChallenge,
  newLoginChallengeId,
  normalizeLoginPhone,
  publicLoginChallengeState,
  requestIpHash,
  retryAfterSeconds,
  setLoginChallengeCookie,
  withLoginPhoneLock,
} from "@/lib/login-otp-challenge";
import { getDevOtpCode, isDevOtpBypassEnabled } from "@/lib/dev-otp";

async function authenticatedLoginResponse(request: NextRequest) {
  const landingPath = await getActiveAuthRedirectPathFromRequest(request);
  return landingPath
    ? NextResponse.json(
        {
          error: "Already signed in. Please log out before signing in with another account.",
          landingPath,
        },
        { status: 409 }
      )
    : null;
}

export async function GET(request: NextRequest) {
  const activeSessionResponse = await authenticatedLoginResponse(request);
  if (activeSessionResponse) return activeSessionResponse;

  let challenge = await loadLoginChallenge(request);
  if (!challenge) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  for (let attempt = 0; challenge.status === LoginOtpChallengeStatus.PENDING_SEND && attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    challenge = await prisma.loginOtpChallenge.findUnique({ where: { id: challenge.id } });
    if (!challenge) return NextResponse.json({ error: "Login OTP challenge not found." }, { status: 404 });
  }
  if (challenge.status === LoginOtpChallengeStatus.PENDING_SEND) {
    return NextResponse.json({ error: "OTP delivery is still in progress.", data: publicLoginChallengeState(challenge) }, { status: 202 });
  }
  return NextResponse.json({ ok: true, data: publicLoginChallengeState(challenge) });
}

export async function POST(request: NextRequest) {
  const activeSessionResponse = await authenticatedLoginResponse(request);
  if (activeSessionResponse) return activeSessionResponse;

  const body = (await request.json().catch(() => null)) as { phoneNumber?: string; intent?: "START_OR_RESUME" | "RESEND" } | null;
  const phoneNumber = normalizeLoginPhone(body?.phoneNumber ?? "");
  const intent = body?.intent === "RESEND" ? "RESEND" : "START_OR_RESUME";
  if (!phoneNumber) return NextResponse.json({ error: "Unable to send OTP." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      phoneNumber: { in: [phoneNumber, `+66${phoneNumber.slice(1)}`] },
      OR: [
        { accountStatus: AccountStatus.ACTIVE },
        {
          accountStatus: AccountStatus.DUPLICATE_ID,
          duplicateNoticeSeenAt: null,
          duplicateNoticeLoginUsedAt: null,
        },
      ],
    },
    select: { phoneNumber: true },
  });
  if (!user) {
    const disabledDuplicate = await prisma.user.findFirst({
      where: {
        phoneNumber: { in: [phoneNumber, `+66${phoneNumber.slice(1)}`] },
        accountStatus: AccountStatus.DUPLICATE_ID,
      },
      select: { id: true },
    });
    return NextResponse.json({
      error: disabledDuplicate
        ? "บัญชีนี้ไม่สามารถใช้งานได้ เนื่องจากเลขบัตรประชาชนถูกใช้กับบัญชีที่ผูกบ้านแล้ว กรุณาสมัครใหม่"
        : "Unable to send OTP.",
    }, { status: disabledDuplicate ? 403 : 400 });
  }

  const now = new Date();
  const reservation = await withLoginPhoneLock(phoneNumber, async (tx) => {
    const existing = await tx.loginOtpChallenge.findUnique({ where: { phoneNumber } });
    // An older challenge may use the alternate +66 representation for the
    // same phone. It is safe to clean that identifier too, but never delete a
    // verification for a genuinely different phone number.
    const verificationIdentifiers = existing && normalizeLoginPhone(existing.otpIdentifier) === phoneNumber
      ? [user.phoneNumber, existing.otpIdentifier]
      : [user.phoneNumber];
    if (existing?.lockedUntil && existing.lockedUntil > now) {
      return { resumed: true as const, challenge: existing, locked: true as const };
    }

    const isRecentInFlight = existing
      && now.getTime() - existing.updatedAt.getTime() < LOGIN_OTP_IN_FLIGHT_MS;
    if (existing?.status === LoginOtpChallengeStatus.PENDING_SEND && isRecentInFlight) {
      return {
        resumed: false as const,
        denied: true as const,
        reason: "in-flight",
        challenge: existing,
        retryAt: new Date(existing.updatedAt.getTime() + LOGIN_OTP_IN_FLIGHT_MS),
      };
    }
    if (existing?.status === LoginOtpChallengeStatus.VERIFYING && isRecentInFlight) {
      return {
        resumed: false as const,
        denied: true as const,
        reason: "verification-in-flight",
        challenge: existing,
        retryAt: new Date(existing.updatedAt.getTime() + LOGIN_OTP_IN_FLIGHT_MS),
      };
    }

    const verification = existing && existing.otpIdentifier === user.phoneNumber
      ? await tx.authVerification.findFirst({
          where: { identifier: existing.otpIdentifier, expiresAt: { gt: now } },
          orderBy: { updatedAt: "desc" },
        })
      : null;
    const hasUsableOtp = Boolean(
      existing
      && existing.otpIdentifier === user.phoneNumber
      && existing.otpSentAt
      && existing.otpExpiresAt
      && existing.otpExpiresAt > now
      && existing.resendAvailableAt
      && verification
    );

    if (intent === "START_OR_RESUME" && existing?.status === LoginOtpChallengeStatus.ACTIVE && hasUsableOtp) {
      return { resumed: true as const, challenge: existing, locked: false as const };
    }

    // A verification call can be interrupted after it has reserved the
    // challenge. Once the in-flight window has elapsed, restore a genuinely
    // usable code to ACTIVE; this does not permit concurrent verification.
    if (intent === "START_OR_RESUME" && existing?.status === LoginOtpChallengeStatus.VERIFYING && hasUsableOtp) {
      const recovered = await tx.loginOtpChallenge.update({
        where: { id: existing.id },
        data: { status: LoginOtpChallengeStatus.ACTIVE },
      });
      return { resumed: true as const, challenge: recovered, locked: false as const };
    }

    // A manual resend must never invalidate a genuinely usable code before
    // its cooldown has elapsed. A stale record is reset below and receives a
    // new cooldown only after a fresh OTP is successfully issued.
    if (
      hasUsableOtp
      && (existing?.status === LoginOtpChallengeStatus.ACTIVE || existing?.status === LoginOtpChallengeStatus.VERIFYING)
      && existing.resendAvailableAt
      && existing.resendAvailableAt > now
    ) {
      return { resumed: false as const, denied: true as const, reason: "cooldown", challenge: existing, retryAt: existing.resendAvailableAt };
    }

    const staleOtpStatuses: LoginOtpChallengeStatus[] = [
      LoginOtpChallengeStatus.PENDING_SEND,
      LoginOtpChallengeStatus.ACTIVE,
      LoginOtpChallengeStatus.VERIFYING,
    ];
    const mayContainStaleOtp = existing && staleOtpStatuses.includes(existing.status);
    if (mayContainStaleOtp) {
      // Never leave an unusable code in a status that looks resumable. Keep an
      // existing resend timestamp so recovery still obeys the cooldown.
      await tx.authVerification.deleteMany({ where: { identifier: { in: verificationIdentifiers } } });
      await tx.loginOtpChallenge.update({
        where: { id: existing.id },
        data: {
          status: LoginOtpChallengeStatus.SEND_FAILED,
          otpSentAt: null,
          otpExpiresAt: null,
          resendAvailableAt: null,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const windowStartedAt = !existing || now.getTime() - existing.sendWindowStartedAt.getTime() >= LOGIN_OTP_SEND_WINDOW_MS
      ? now
      : existing.sendWindowStartedAt;
    const sendCount = windowStartedAt === now ? 0 : existing?.sendCount ?? 0;
    if (sendCount >= LOGIN_OTP_MAX_SENDS_PER_WINDOW) {
      return { resumed: false as const, denied: true as const, reason: "rate-limit", challenge: existing!, retryAt: new Date(windowStartedAt.getTime() + LOGIN_OTP_SEND_WINDOW_MS) };
    }

    const challengeToken = newLoginChallengeId();
    const challenge = await tx.loginOtpChallenge.upsert({
      where: { phoneNumber },
      create: {
        phoneNumber,
        otpIdentifier: user.phoneNumber,
        challengeToken,
        status: LoginOtpChallengeStatus.PENDING_SEND,
        sendWindowStartedAt: windowStartedAt,
        sendCount: sendCount + 1,
        ipHash: requestIpHash(request),
      },
      update: {
        otpIdentifier: user.phoneNumber,
        challengeToken,
        status: LoginOtpChallengeStatus.PENDING_SEND,
        otpSentAt: null,
        otpExpiresAt: null,
        resendAvailableAt: null,
        failedAttempts: 0,
        lockedUntil: null,
        sendWindowStartedAt: windowStartedAt,
        sendCount: sendCount + 1,
        ipHash: requestIpHash(request),
      },
    });
    await tx.authVerification.deleteMany({ where: { identifier: { in: verificationIdentifiers } } });
    return { resumed: false as const, denied: false as const, challenge };
  });

  if (reservation.resumed) {
    const locked = reservation.locked;
    const response = NextResponse.json({
      ok: true,
      outcome: locked ? "LOCKED" : "RESUME_EXISTING_CHALLENGE",
      retryAfterSeconds: locked ? retryAfterSeconds(reservation.challenge.lockedUntil, now) : undefined,
      data: publicLoginChallengeState(reservation.challenge),
    });
    setLoginChallengeCookie(response, reservation.challenge.challengeToken);
    return response;
  }

  if (reservation.denied) {
    return NextResponse.json({
      error: reservation.reason === "verification-in-flight"
        ? "OTP verification is already in progress."
        : reservation.reason === "in-flight"
          ? "OTP delivery is still in progress."
          : "Please wait before requesting another OTP.",
      retryAfterSeconds: retryAfterSeconds(reservation.retryAt, now),
      data: publicLoginChallengeState(reservation.challenge),
    }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds(reservation.retryAt, now)) } });
  }

  try {
    if (isDevOtpBypassEnabled()) {
      await prisma.authVerification.create({ data: { identifier: user.phoneNumber, value: `${getDevOtpCode()}:0`, expiresAt: new Date(Date.now() + LOGIN_OTP_TTL_MS) } });
    } else {
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: user.phoneNumber } });
    }
  } catch {
    await withLoginPhoneLock(phoneNumber, async (tx) => {
      await tx.authVerification.deleteMany({ where: { identifier: user.phoneNumber } });
      await tx.loginOtpChallenge.updateMany({
        where: { id: reservation.challenge.id, status: LoginOtpChallengeStatus.PENDING_SEND },
        data: { status: LoginOtpChallengeStatus.SEND_FAILED, otpSentAt: null, otpExpiresAt: null, resendAvailableAt: null },
      });
    });
    return NextResponse.json({ error: "OTP provider could not send the code." }, { status: 502 });
  }

  const sentAt = new Date();
  const challenge = await withLoginPhoneLock(phoneNumber, (tx) => tx.loginOtpChallenge.update({
    where: { id: reservation.challenge.id },
    data: {
      status: LoginOtpChallengeStatus.ACTIVE,
      otpSentAt: sentAt,
      otpExpiresAt: new Date(sentAt.getTime() + LOGIN_OTP_TTL_MS),
      resendAvailableAt: new Date(sentAt.getTime() + LOGIN_OTP_RESEND_COOLDOWN_MS),
      failedAttempts: 0,
      lockedUntil: null,
    },
  }));
  const response = NextResponse.json({ ok: true, outcome: isDevOtpBypassEnabled() ? "DEV_OTP_READY" : "OTP_SENT", data: publicLoginChallengeState(challenge) });
  setLoginChallengeCookie(response, challenge.challengeToken);
  return response;
}
