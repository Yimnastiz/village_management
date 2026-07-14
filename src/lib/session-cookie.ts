import { cookies } from "next/headers";

export const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth-session_token",
] as const;

export const SESSION_COOKIE = SESSION_COOKIE_NAMES[0];

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
