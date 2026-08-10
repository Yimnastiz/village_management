"use client";
import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

const AUTH_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/auth`
    : "http://localhost:3000/api/auth";

export const authClient = createAuthClient({
  // Use an absolute base URL in the browser so the client communicates with the
  // same origin/port the page was served from. During SSR/build the fallback
  // value prevents creating an invalid base URL.
  baseURL: AUTH_BASE_URL,
  plugins: [phoneNumberClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

/**
 * Better Auth reports HTTP failures in `error` instead of necessarily
 * throwing, so callers must confirm the result before navigating.
 */
export async function signOutCurrentSession(): Promise<boolean> {
  const result = await signOut();
  return result.data?.success === true && !result.error;
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
