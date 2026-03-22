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
