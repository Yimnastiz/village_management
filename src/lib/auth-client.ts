"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

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
