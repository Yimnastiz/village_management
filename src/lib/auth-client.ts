"use client";
import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [phoneNumberClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

/**
 * Better Auth reports HTTP failures in `error` instead of necessarily
 * throwing, so callers must confirm the result before navigating.
 */
type SignOutFailureDetails = {
  errorType: string;
  message: string;
  status?: number;
  statusText?: string;
  code?: string;
  url?: string;
  cause?: string;
};

export class SignOutError extends Error {
  readonly details: SignOutFailureDetails;

  constructor(details: SignOutFailureDetails) {
    super(details.message);
    this.name = "SignOutError";
    this.details = details;
  }
}

function safeFailureDetails(value: unknown): SignOutFailureDetails {
  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const cause = record.cause;

  return {
    errorType: value instanceof Error ? value.name : "BetterFetchError",
    message:
      (typeof record.message === "string" && record.message) ||
      (value instanceof Error ? value.message : "Better Auth sign-out failed."),
    ...(typeof record.status === "number" ? { status: record.status } : {}),
    ...(typeof record.statusText === "string" ? { statusText: record.statusText } : {}),
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(cause instanceof Error
      ? { cause: `${cause.name}: ${cause.message}` }
      : typeof cause === "string"
        ? { cause }
        : {}),
  };
}

/** Sign out through Better Auth's single canonical request. */
export async function signOutCurrentSession(): Promise<void> {
  let hookFailure: SignOutFailureDetails | null = null;
  let succeeded = false;
  const result = await signOut({
    fetchOptions: {
      onSuccess: (context) => {
        succeeded = context.data?.success === true;
      },
      onError: (context) => {
        hookFailure = {
          ...safeFailureDetails(context.error),
          status: context.response.status,
          statusText: context.response.statusText,
          url: new URL(context.request.url.toString(), window.location.origin).pathname,
        };
      },
    },
  });

  if (result.error) {
    throw new SignOutError(hookFailure ?? safeFailureDetails(result.error));
  }
  if (!succeeded || result.data?.success !== true) {
    throw new SignOutError({
      errorType: "InvalidSignOutResponse",
      message: "Better Auth did not confirm sign-out success.",
    });
  }
}

const LOGIN_OTP_STATE_KEY = "village_auth_login_otp";
const LOGIN_OTP_STATE_TTL_MS = 5 * 60 * 1000;

export type LoginOtpState = {
  phoneNumber: string;
  callbackUrl: string | null;
  outcome?: "OTP_SENT" | "RESUME_EXISTING_CHALLENGE" | "LOCKED";
  createdAt: number;
};

export function saveLoginOtpState(phoneNumber: string, callbackUrl: string | null, outcome?: LoginOtpState["outcome"]) {
  if (typeof window === "undefined") return;

  const state: LoginOtpState = {
    phoneNumber,
    callbackUrl,
    outcome,
    createdAt: Date.now(),
  };
  window.sessionStorage.setItem(LOGIN_OTP_STATE_KEY, JSON.stringify(state));
}

export function loadLoginOtpState(): LoginOtpState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(LOGIN_OTP_STATE_KEY);
    if (!raw) return null;

    const state = JSON.parse(raw) as LoginOtpState;
    if (
      !/^\d{10}$/.test(state?.phoneNumber ?? "") ||
      typeof state.createdAt !== "number" ||
      Date.now() - state.createdAt > LOGIN_OTP_STATE_TTL_MS
    ) {
      clearLoginOtpState();
      return null;
    }

    return state;
  } catch {
    clearLoginOtpState();
    return null;
  }
}

export function clearLoginOtpState() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(LOGIN_OTP_STATE_KEY);
  }
}
