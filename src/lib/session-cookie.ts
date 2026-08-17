import { cookies } from "next/headers";

export const CURRENT_SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

// Kept only to invalidate cookies issued by an older application release.
// Better Auth 1.5.5 uses the names above (with __Secure- on HTTPS).
export const LEGACY_SESSION_COOKIE_NAMES = [
  "better-auth-session_token",
  "__Secure-better-auth-session_token",
] as const;

export const SESSION_COOKIE_NAMES = [
  ...CURRENT_SESSION_COOKIE_NAMES,
  ...LEGACY_SESSION_COOKIE_NAMES,
] as const;

export const SESSION_COOKIE = SESSION_COOKIE_NAMES[0];

/**
 * Expire every session cookie name that this application has issued.  This is
 * deliberately shared by the proxy and explicit sign-out flows: deleting a
 * server-side AuthSession alone leaves the browser presenting a stale token.
 */
export function expireSessionCookies(response: Response) {
  for (const name of SESSION_COOKIE_NAMES) {
    const secure = name.startsWith("__Secure-") ? "; Secure" : "";
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
    );
  }
}

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function readSessionCookieFromStore(store: CookieReader): string | null {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = store.get(name)?.value;
    if (value) return value;
  }
  return null;
}

export function readSessionCookieFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const values = new Map(
    cookieHeader.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, rest.join("=")] as const;
    })
  );
  for (const name of SESSION_COOKIE_NAMES) {
    const value = values.get(name);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

export function readNamedSessionCookiesFromHeader(
  cookieHeader: string | null,
  names: readonly string[]
): string[] {
  if (!cookieHeader) return [];

  const values = new Map(
    cookieHeader.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, rest.join("=")] as const;
    })
  );

  return names.flatMap((name) => {
    const value = values.get(name);
    return value ? [decodeURIComponent(value)] : [];
  });
}

export async function readSessionCookieFromServer(): Promise<string | null> {
  return readSessionCookieFromStore(await cookies());
}

export function readSessionCookieFromRequest(request: Request): string | null {
  if ("cookies" in request) {
    const requestWithCookies = request as Request & { cookies?: CookieReader };
    if (requestWithCookies.cookies) {
      return readSessionCookieFromStore(requestWithCookies.cookies);
    }
  }
  return readSessionCookieFromHeader(request.headers.get("cookie"));
}

export function getTokenLogMetadata(token: string | null) {
  return {
    hasToken: Boolean(token),
    tokenLength: token?.length ?? 0,
    tokenPrefix: token ? token.slice(0, 6) : null,
  };
}
