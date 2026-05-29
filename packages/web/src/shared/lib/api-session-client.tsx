"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import { getSession, logout } from "@/shared/api/generated/auth/auth";
import type { AuthUserDto, SessionResponseDto } from "@/shared/api/generated/model";

export interface Session {
  user: AuthUserDto;
}

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface ApiSessionContextValue {
  data: Session | null;
  status: SessionStatus;
  update: () => Promise<Session | null>;
}

export const apiSessionQueryKey = ["api-session"] as const;

const ApiSessionContext = createContext<ApiSessionContextValue | null>(null);

function toSession(response: SessionResponseDto): Session | null {
  return response.authenticated && response.user ? { user: response.user } : null;
}

export function ApiSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: apiSessionQueryKey,
    queryFn: getSession,
    retry: false,
    staleTime: 60_000,
  });

  const value = useMemo<ApiSessionContextValue>(() => {
    const session = sessionQuery.data ? toSession(sessionQuery.data) : null;
    const status: SessionStatus = sessionQuery.isPending ? "loading" : session ? "authenticated" : "unauthenticated";

    return {
      data: session,
      status,
      update: async () => {
        const response = await queryClient.fetchQuery({
          queryKey: apiSessionQueryKey,
          queryFn: getSession,
          staleTime: 0,
        });
        return toSession(response);
      },
    };
  }, [queryClient, sessionQuery.data, sessionQuery.isPending]);

  return <ApiSessionContext.Provider value={value}>{children}</ApiSessionContext.Provider>;
}

export function useSession(): ApiSessionContextValue {
  const context = useContext(ApiSessionContext);
  if (!context) {
    throw new Error("useSession must be used within ApiSessionProvider");
  }
  return context;
}

export async function signOut(options: { callbackUrl?: string } = {}) {
  await logout();
  window.location.assign(options.callbackUrl ?? "/login");
}
