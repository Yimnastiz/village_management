import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import type { AccountLoginIdentity } from "@/lib/account-login-resolver";

type VerifiedIdentity = AccountLoginIdentity & { callbackUrl: string; challengeId: string };
type Dependencies = {
  verifyAccountLoginOtp: (headers: Headers, input: { flowId: string; code: string }) => Promise<VerifiedIdentity>;
  consumeAccountLoginOtp: (input: { flowId: string; challengeId: string; sessionId: string; sessionToken: string; identity: VerifiedIdentity }) => Promise<void>;
};
const verifyBody = z.object({ flowId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

/** Creates the authenticated session through Better Auth after server-owned identity resolution. */
export function accountLoginAuthPlugin(dependencies: Dependencies) {
  return {
    id: "account-email-login",
    endpoints: {
      verifyAccountLogin: createAuthEndpoint("/account-login/verify", { method: "POST", body: verifyBody }, async (ctx) => {
        let identity: VerifiedIdentity;
        try { identity = await dependencies.verifyAccountLoginOtp(ctx.headers ?? new Headers(), ctx.body); }
        catch { throw new APIError("UNAUTHORIZED", { message: "ไม่สามารถยืนยันรหัสเข้าสู่ระบบได้" }); }
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
