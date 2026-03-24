import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber } from "better-auth/plugins";
import { prisma } from "./prisma";

const defaultBaseUrl = "http://localhost:3000";
const appUrl = process.env.BETTER_AUTH_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;

if (!authSecret) {
  throw new Error(
    "Missing BETTER_AUTH_SECRET. Please set BETTER_AUTH_SECRET in your .env file."
  );
}

function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export const auth = betterAuth({
  baseURL: appUrl
    ? appUrl
    : {
        allowedHosts: ["localhost:*", "127.0.0.1:*"],
        fallback: defaultBaseUrl,
      },
  secret: authSecret,
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
      sendOTP: async ({ phoneNumber, code }) => {
        // Development mode: log to console and mock SMS
        console.log(`\n🔐 [OTP Sent to ${phoneNumber}]`);
        console.log(`📲 Your OTP Code: ${code}`);
        console.log(`⏰ Valid for 15 minutes\n`);
        
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
    ...(appUrl ? [appUrl] : []),
    "http://localhost:*",
    "http://127.0.0.1:*",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
