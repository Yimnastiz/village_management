import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { createHouseOpeningAccessToken, HOUSE_OPENING_ACCESS_COOKIE, HOUSE_OPENING_ACCESS_TTL_SECONDS } from "@/lib/house-account-opening-access";
import type { AccountLoginIdentity } from "@/lib/account-login-resolver";
import type { VerifiedAccountLogin } from "@/lib/account-login-service";

type VerifiedIdentity = AccountLoginIdentity & { callbackUrl: string; challengeId: string };
type Dependencies = {
  verifyAccountLoginOtp: (headers: Headers, input: { flowId: string; code: string }) => Promise<VerifiedAccountLogin>;
  consumeAccountLoginOtp: (input: { flowId: string; challengeId: string; sessionId: string; sessionToken: string; identity: VerifiedIdentity }) => Promise<void>;
  consumePendingAccountLoginOtp: (input: { flowId: string; challengeId: string; requestId: string }) => Promise<void>;
};
const verifyBody = z.object({ flowId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

/** Creates the authenticated session through Better Auth after server-owned identity resolution. */
export function accountLoginAuthPlugin(dependencies: Dependencies) {
  return {
    id: "account-email-login",
    endpoints: {
      verifyAccountLogin: createAuthEndpoint("/account-login/verify", { method: "POST", body: verifyBody }, async (ctx) => {
        let login: VerifiedAccountLogin;
        try { login = await dependencies.verifyAccountLoginOtp(ctx.headers ?? new Headers(), ctx.body); }
        catch { throw new APIError("UNAUTHORIZED", { message: "ไม่สามารถยืนยันรหัสเข้าสู่ระบบได้" }); }
        if (login.kind === "PENDING") {
          try { await dependencies.consumePendingAccountLoginOtp({ flowId: ctx.body.flowId, challengeId: login.challengeId, requestId: login.requestId }); }
          catch { throw new APIError("UNAUTHORIZED", { message: "Pending account is no longer available." }); }
          ctx.setCookie(HOUSE_OPENING_ACCESS_COOKIE, createHouseOpeningAccessToken(login.requestId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: HOUSE_OPENING_ACCESS_TTL_SECONDS });
          ctx.setCookie("account_login_flow", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth", maxAge: 0 });
          return ctx.json({ ok: true, landingPath: "/resident/dashboard" });
        }
        const identity = login.identity;
        const user = await ctx.context.internalAdapter.findUserById(identity.userId);
        if (!user) throw new APIError("UNAUTHORIZED", { message: "บัญชีไม่พร้อมใช้งาน" });
        const session = await ctx.context.internalAdapter.createSession(identity.userId, false, { activeVillageId: identity.villageId, loginAccountEmailId: identity.accountEmailId });
        if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "ไม่สามารถสร้างเซสชันเข้าสู่ระบบได้" });
        try { await dependencies.consumeAccountLoginOtp({ flowId: ctx.body.flowId, challengeId: identity.challengeId, sessionId: session.id, sessionToken: session.token, identity }); }
        catch { await ctx.context.internalAdapter.deleteSession(session.token); throw new APIError("UNAUTHORIZED", { message: "รหัสถูกใช้แล้วหรือบัญชีไม่พร้อมใช้งาน" }); }
        try { await setSessionCookie(ctx, { session, user }); }
        catch (error) { await ctx.context.internalAdapter.deleteSession(session.token); throw error; }
        ctx.setCookie("account_login_flow", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth", maxAge: 0 });
        return ctx.json({ ok: true, landingPath: identity.callbackUrl });
      }),
    },
    rateLimit: [{ pathMatcher: (path: string) => path === "/account-login/verify", window: 60, max: 10 }],
  };
}
