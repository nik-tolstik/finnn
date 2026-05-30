import { createHash } from "node:crypto";

export const AUTH_COOKIE_NAME = "finnn_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function normalizeSameSite(value: string | undefined): "Lax" | "Strict" | "None" {
  switch (value?.toLowerCase()) {
    case "strict":
      return "Strict";
    case "none":
      return "None";
    default:
      return "Lax";
  }
}

function getConfiguredCookieDomain(): string | null {
  const domain = process.env.API_COOKIE_DOMAIN?.trim();
  return domain ? domain : null;
}

function shouldUseSecureCookie(): boolean {
  if (process.env.API_COOKIE_SECURE) {
    return process.env.API_COOKIE_SECURE === "true";
  }

  return process.env.NODE_ENV === "production";
}

function getCookieOptions() {
  const sameSite = normalizeSameSite(process.env.API_COOKIE_SAME_SITE);
  const secure = shouldUseSecureCookie();

  if (sameSite === "None" && !secure) {
    return { sameSite: "Lax" as const, secure };
  }

  return { sameSite, secure };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseSessionCookies(cookieHeader: string | undefined): string[] {
  if (!cookieHeader) return [];

  const tokens: string[] = [];
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rawValue] = cookie.trim().split("=");
    if (name === AUTH_COOKIE_NAME) {
      tokens.push(decodeURIComponent(rawValue.join("=")));
    }
  }

  return tokens;
}

export function parseSessionCookie(cookieHeader: string | undefined): string | null {
  return parseSessionCookies(cookieHeader).at(-1) ?? null;
}

export function createSessionCookie(token: string): string {
  const { sameSite, secure } = getCookieOptions();
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    `SameSite=${sameSite}`,
  ];

  if (secure) parts.push("Secure");
  const domain = getConfiguredCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);

  return parts.join("; ");
}

export function createClearSessionCookie(): string {
  const { sameSite, secure } = getCookieOptions();
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${sameSite}`,
  ];

  if (secure) parts.push("Secure");
  const domain = getConfiguredCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);

  return parts.join("; ");
}

export function getSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}
