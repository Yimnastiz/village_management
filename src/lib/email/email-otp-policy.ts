import type { EmailOtpChallengeStatus } from "@prisma/client";

export type EmailOtpVerificationEligibility = "OK" | "EXPIRED" | "LOCKED" | "UNAVAILABLE";
export type EmailOtpResendEligibility = "OK" | "EXPIRED" | "COOLDOWN" | "MAX_RESENDS" | "UNAVAILABLE";

export function emailOtpVerificationEligibility(
  challenge: {
    status: EmailOtpChallengeStatus;
    expiresAt: Date;
    attemptCount: number;
    maxAttempts: number;
  },
  now = new Date(),
): EmailOtpVerificationEligibility {
  if (challenge.status === "LOCKED" || challenge.attemptCount >= challenge.maxAttempts) return "LOCKED";
  if (challenge.expiresAt <= now) return "EXPIRED";
  return challenge.status === "ACTIVE" ? "OK" : "UNAVAILABLE";
}

export function failedEmailOtpAttempt(
  attemptCount: number,
  maxAttempts: number,
): { attemptCount: number; status: "ACTIVE" | "LOCKED" } {
  const nextAttemptCount = attemptCount + 1;
  return {
    attemptCount: nextAttemptCount,
    status: nextAttemptCount >= maxAttempts ? "LOCKED" : "ACTIVE",
  };
}

export function emailOtpResendEligibility(
  challenge: {
    status: EmailOtpChallengeStatus;
    expiresAt: Date;
    resendCount: number;
    maxResends: number;
    resendAvailableAt: Date | null;
  },
  now = new Date(),
): EmailOtpResendEligibility {
  if (challenge.status !== "ACTIVE") return "UNAVAILABLE";
  if (challenge.expiresAt <= now) return "EXPIRED";
  if (challenge.resendCount >= challenge.maxResends) return "MAX_RESENDS";
  if (challenge.resendAvailableAt && challenge.resendAvailableAt > now) return "COOLDOWN";
  return "OK";
}

const EMAIL_OTP_TRANSITIONS: Record<EmailOtpChallengeStatus, ReadonlySet<EmailOtpChallengeStatus>> = {
  PENDING_DELIVERY: new Set(["ACTIVE", "DELIVERY_FAILED", "CANCELLED"]),
  ACTIVE: new Set(["PENDING_DELIVERY", "VERIFIED", "LOCKED", "EXPIRED", "CANCELLED"]),
  VERIFIED: new Set(["CONSUMED", "EXPIRED", "CANCELLED"]),
  CONSUMED: new Set(),
  LOCKED: new Set(),
  EXPIRED: new Set(),
  CANCELLED: new Set(),
  DELIVERY_FAILED: new Set(),
};

export function canTransitionEmailOtpChallenge(
  from: EmailOtpChallengeStatus,
  to: EmailOtpChallengeStatus,
): boolean {
  return EMAIL_OTP_TRANSITIONS[from].has(to);
}
