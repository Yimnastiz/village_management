import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
type VerifiedHouseLoginIdentity = {
  accountEmailId: string;
  userId: string;
  residentHouseAccountId: string;
  villageId: string;
  houseId: string;
  houseNumber: string;
  email: string;
  normalizedEmail: string;
  callbackUrl: string;
  challengeId: string;
};

type HouseAccountAuthPluginDependencies = {
  verifyHouseAccountLoginOtp: (
    headers: Headers,
    input: { flowId: string; code: string },
  ) => Promise<VerifiedHouseLoginIdentity>;
  consumeHouseAccountLoginOtp: (input: {
    flowId: string;
    challengeId: string;
    sessionId: string;
    sessionToken: string;
    identity: VerifiedHouseLoginIdentity;
  }) => Promise<void>;
};

const verifyBody = z.object({
  flowId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

/**
 * Better Auth 1.5.5 session bridge for an already-known House Account User.
 * Session creation and cookie serialization deliberately stay inside Better
 * Auth's endpoint context; this module never constructs either format.
 */
export function houseAccountAuthPlugin(dependencies: HouseAccountAuthPluginDependencies) {
  return {
    id: "house-account-auth",
    endpoints: {
      verifyHouseAccountLogin: createAuthEndpoint(
        "/house-login/verify",
        {
          method: "POST",
          body: verifyBody,
        },
        async (ctx) => {
          let identity;
          try {
            identity = await dependencies.verifyHouseAccountLoginOtp(ctx.headers ?? new Headers(), ctx.body);
          } catch {
            throw new APIError("UNAUTHORIZED", {
              message: "ไม่สามารถยืนยันรหัสเข้าสู่ระบบได้",
            });
          }

          const user = await ctx.context.internalAdapter.findUserById(identity.userId);
          if (!user) {
            throw new APIError("UNAUTHORIZED", { message: "บัญชีบ้านไม่พร้อมใช้งาน" });
          }

          const session = await ctx.context.internalAdapter.createSession(
            identity.userId,
            false,
            {
              activeVillageId: identity.villageId,
              loginAccountEmailId: identity.accountEmailId,
            },
          );
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "ไม่สามารถสร้างเซสชันเข้าสู่ระบบได้",
            });
          }

          try {
            await dependencies.consumeHouseAccountLoginOtp({
              flowId: ctx.body.flowId,
              challengeId: identity.challengeId,
              sessionId: session.id,
              sessionToken: session.token,
              identity,
            });
          } catch {
            await ctx.context.internalAdapter.deleteSession(session.token);
            throw new APIError("UNAUTHORIZED", {
              message: "รหัสเข้าสู่ระบบถูกใช้แล้วหรือบัญชีไม่พร้อมใช้งาน",
            });
          }

          try {
            await setSessionCookie(ctx, { session, user });
          } catch (error) {
            await ctx.context.internalAdapter.deleteSession(session.token);
            throw error;
          }

          ctx.setCookie("house_login_flow", "", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/api/auth",
            maxAge: 0,
          });
          return ctx.json({
            ok: true,
            landingPath: identity.callbackUrl,
          });
        },
      ),
    },
    rateLimit: [{
      pathMatcher: (path: string) => path === "/house-login/verify",
      window: 60,
      max: 10,
    }],
  };
}
