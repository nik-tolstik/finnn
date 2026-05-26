import { cookies } from "next/headers";
import { cache } from "react";

import type { AuthUserDto, SessionResponseDto } from "@/shared/api/generated/model";
import { getApiBaseUrl } from "@/shared/api/http-client";

export const AUTH_COOKIE_NAME = "finnn_session";

export interface Session {
  user: AuthUserDto;
}

export async function fetchServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/auth/session`, {
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const session = (await response.json()) as SessionResponseDto;
  return session.authenticated && session.user ? { user: session.user } : null;
}

export const getCachedServerSession = cache(fetchServerSession);
