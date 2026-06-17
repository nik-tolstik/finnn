import { getApiBaseUrl } from "@/shared/api/http-client";

function toSearchParams(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  return searchParams.toString();
}

export function getGoogleAuthStartUrl(returnTo?: string): string {
  const query = toSearchParams({ returnTo });
  return `${getApiBaseUrl()}/auth/google/start${query ? `?${query}` : ""}`;
}

export function getGoogleLinkStartUrl(returnTo?: string): string {
  const query = toSearchParams({ returnTo });
  return `${getApiBaseUrl()}/auth/google/link/start${query ? `?${query}` : ""}`;
}

export function redirectToGoogleAuth(returnTo?: string): void {
  window.location.assign(getGoogleAuthStartUrl(returnTo));
}

export function redirectToGoogleLink(returnTo?: string): void {
  window.location.assign(getGoogleLinkStartUrl(returnTo));
}
