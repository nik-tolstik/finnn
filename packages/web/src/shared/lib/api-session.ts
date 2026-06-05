import { cookies } from "next/headers";
import { cache } from "react";

import type { AuthUserDto, SessionResponseDto } from "@/shared/api/generated/model";
import { getApiBaseUrl } from "@/shared/api/http-client";

const AUTH_COOKIE_NAME = "finnn_session";

export interface Session {
  user: AuthUserDto;
}

export async function getServerApiRequestOptions(): Promise<RequestInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return {};
  }

  return {
    cache: "no-store",
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    },
  };
}

export async function fetchServerSession(): Promise<Session | null> {
  const requestOptions = await getServerApiRequestOptions();

  if (!requestOptions.headers) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/auth/session`, {
      headers: requestOptions.headers,
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const session = (await response.json()) as SessionResponseDto;
  return session.authenticated && session.user ? { user: session.user } : null;
}

export const getCachedServerSession = cache(fetchServerSession);
