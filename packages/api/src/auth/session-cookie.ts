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

function shouldUseSecureCookie(): boolean {
  if (process.env.API_COOKIE_SECURE) {
    return process.env.API_COOKIE_SECURE === "true";
  }

  return process.env.NODE_ENV === "production";
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rawValue] = cookie.trim().split("=");
    if (name === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function createSessionCookie(token: string): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    `SameSite=${normalizeSameSite(process.env.API_COOKIE_SAME_SITE)}`,
  ];

  if (shouldUseSecureCookie()) parts.push("Secure");
  if (process.env.API_COOKIE_DOMAIN) parts.push(`Domain=${process.env.API_COOKIE_DOMAIN}`);

  return parts.join("; ");
}

export function createClearSessionCookie(): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${normalizeSameSite(process.env.API_COOKIE_SAME_SITE)}`,
  ];

  if (shouldUseSecureCookie()) parts.push("Secure");
  if (process.env.API_COOKIE_DOMAIN) parts.push(`Domain=${process.env.API_COOKIE_DOMAIN}`);

  return parts.join("; ");
}

export function getSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}
