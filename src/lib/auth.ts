import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber } from "better-auth/plugins";
import { prisma } from "./prisma";

const defaultBaseUrl = "http://localhost:3000";
const appUrl = process.env.BETTER_AUTH_URL;
const isProduction = process.env.NODE_ENV === "production";
const authSecret = process.env.BETTER_AUTH_SECRET;
const shouldShowDevelopmentOtp =
  process.env.NODE_ENV === "development" &&
  process.env.DEV_SHOW_OTP === "true";

if (!authSecret) {
  throw new Error(
    "Missing BETTER_AUTH_SECRET. Please set BETTER_AUTH_SECRET in your .env file."
  );
}

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export const auth = betterAuth({
  // In development resolve the auth origin from each request so Next can move
  // between 3000/3001 and localhost/127.0.0.1. Production uses its configured
  // canonical URL.
  baseURL: isProduction && appUrl
    ? appUrl
    : {
        allowedHosts: ["localhost:*", "127.0.0.1:*"],
        fallback: defaultBaseUrl,
      },
  secret: authSecret,
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/phone-number/send-otp": { window: 60, max: 5 },
      "/phone-number/verify": { window: 60, max: 10 },
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    modelName: "User",
    fields: {
      name: "name",
      email: "email",
      emailVerified: "emailVerified",
      image: "image",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  session: {
    modelName: "AuthSession",
    fields: {
      expiresAt: "expiresAt",
      token: "token",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      ipAddress: "ipAddress",
      userAgent: "userAgent",
      userId: "userId",
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Keep session state in DB only. Cookie cache can exceed header limits
    // when profile image or other user fields become large, causing HTTP 431.
    cookieCache: {
      enabled: false,
      maxAge: 60 * 60 * 24 * 7,
    },
  },
  account: {
    modelName: "AuthAccount",
    fields: {
      accountId: "accountId",
      providerId: "providerId",
      userId: "userId",
      accessToken: "accessToken",
      refreshToken: "refreshToken",
      idToken: "idToken",
      accessTokenExpiresAt: "accessTokenExpiresAt",
      refreshTokenExpiresAt: "refreshTokenExpiresAt",
      scope: "scope",
      password: "password",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  verification: {
    modelName: "AuthVerification",
    fields: {
      identifier: "identifier",
      value: "value",
      expiresAt: "expiresAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  plugins: [
    phoneNumber({
      expiresIn: 60 * 5,
      allowedAttempts: 5,
      sendOTP: async ({ phoneNumber, code }) => {
        const maskedOtpLog = {
          phoneSuffix: phoneNumber.slice(-4),
          codeLength: code.length,
          expiresInSeconds: 300,
        };

        if (shouldShowDevelopmentOtp) {
          console.log("[auth] OTP generated", {
            ...maskedOtpLog,
            otp: code,
          });
        } else {
          console.log("[auth] OTP generated", maskedOtpLog);
        }
        
        // TODO: integrate with SMS provider (e.g. Twilio, DTAC, AIS)
        // For production:
        // await sendSMS(phoneNumber, `Your OTP code is: ${code}`);
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) =>
          `phone_${normalizePhoneNumber(phoneNumber)}@local.invalid`,
        getTempName: (phoneNumber) => normalizePhoneNumber(phoneNumber),
      },
      phoneNumberValidator: (phoneNumber) =>
        /^\+?\d{9,15}$/.test(normalizePhoneNumber(phoneNumber)),
    }),
  ],
  trustedOrigins: [
    ...(isProduction
      ? appUrl ? [appUrl] : []
      : ["http://localhost:*", "http://127.0.0.1:*"]),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
