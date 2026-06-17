export const GOOGLE_STATE_COOKIE_NAME = "finnn_google_state";

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

export function createGoogleStateCookie(value: string, maxAgeSeconds: number): string {
  const { sameSite, secure } = getCookieOptions();
  const parts = [
    `${GOOGLE_STATE_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/auth/google/callback",
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${sameSite}`,
  ];

  if (secure) parts.push("Secure");
  const domain = getConfiguredCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);

  return parts.join("; ");
}

export function createClearGoogleStateCookie(): string {
  const { sameSite, secure } = getCookieOptions();
  const parts = [
    `${GOOGLE_STATE_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/auth/google/callback",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${sameSite}`,
  ];

  if (secure) parts.push("Secure");
  const domain = getConfiguredCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);

  return parts.join("; ");
}

export function parseGoogleStateCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rawValue] = cookie.trim().split("=");
    if (name === GOOGLE_STATE_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}
