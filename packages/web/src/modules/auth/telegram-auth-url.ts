import { getApiBaseUrl } from "@/shared/api/http-client";

function toSearchParams(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  return searchParams.toString();
}

export function getTelegramAuthStartUrl(returnTo?: string): string {
  const query = toSearchParams({ returnTo });
  return `${getApiBaseUrl()}/auth/telegram/start${query ? `?${query}` : ""}`;
}

export function getTelegramLinkStartUrl(returnTo?: string): string {
  const query = toSearchParams({ returnTo });
  return `${getApiBaseUrl()}/auth/telegram/link/start${query ? `?${query}` : ""}`;
}

export function redirectToTelegramAuth(returnTo?: string): void {
  window.location.assign(getTelegramAuthStartUrl(returnTo));
}

export function redirectToTelegramLink(returnTo?: string): void {
  window.location.assign(getTelegramLinkStartUrl(returnTo));
}
