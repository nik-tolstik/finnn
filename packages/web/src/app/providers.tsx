"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { TelegramMiniAppBootstrap } from "@/modules/telegram-mini/TelegramMiniAppBootstrap";
import { isEmailVerificationRequiredError } from "@/shared/api/http-client";
import { ServiceWorkerRegistration } from "@/shared/components/ServiceWorkerRegistration";
import { ApiSessionProvider, apiSessionQueryKey } from "@/shared/lib/api-session-client";

function ThemeClassSync() {
  const { resolvedTheme, theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const nextTheme = theme === "system" ? resolvedTheme : theme;

    root.classList.remove("light", "dark");

    if (nextTheme === "light" || nextTheme === "dark") {
      root.classList.add(nextTheme);
      root.style.colorScheme = nextTheme;
    } else {
      root.style.removeProperty("color-scheme");
    }
  }, [resolvedTheme, theme]);

  return null;
}

function redirectToEmailRequired(queryClient: QueryClient): void {
  if (typeof window === "undefined" || window.location.pathname === "/email-required") return;

  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== apiSessionQueryKey[0],
  });

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/email-required?returnTo=${encodeURIComponent(returnTo)}`);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          if (isEmailVerificationRequiredError(error)) {
            redirectToEmailRequired(client);
          }
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          if (isEmailVerificationRequiredError(error)) {
            redirectToEmailRequired(client);
          }
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 0,
          gcTime: 10 * 60_000,
          refetchOnWindowFocus: false,
        },
      },
    });
    return client;
  });

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ApiSessionProvider>
          <TelegramMiniAppBootstrap>
            <ThemeClassSync />
            {children}
            <ServiceWorkerRegistration />
          </TelegramMiniAppBootstrap>
        </ApiSessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
