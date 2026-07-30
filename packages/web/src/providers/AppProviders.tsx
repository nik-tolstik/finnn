import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { type NavigateFunction, useNavigate } from "react-router";

import { TelegramMiniAppBootstrap } from "@/modules/telegram-mini/TelegramMiniAppBootstrap";
import { isEmailVerificationRequiredError } from "@/shared/api/http-client";
import { AccentColorProvider } from "@/shared/components/accent-color-provider";
import { PullToRefresh } from "@/shared/components/pull-to-refresh";
import { ServiceWorkerRegistration } from "@/shared/components/ServiceWorkerRegistration";
import { ApiSessionProvider, apiSessionQueryKey } from "@/shared/lib/api-session-client";
import { getThemeLogoPath } from "@/shared/lib/theme-logo";
import { Toaster } from "@/shared/ui/sonner";

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

    const faviconUrl = getThemeLogoPath(nextTheme);
    if (!faviconUrl) return;

    const faviconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');

    for (const link of faviconLinks) {
      link.href = faviconUrl;
      link.type = "image/svg+xml";
      link.sizes = "any";
      link.media = "";
    }
  }, [resolvedTheme, theme]);

  return null;
}

function redirectToEmailRequired(queryClient: QueryClient, navigate: NavigateFunction): void {
  if (typeof window === "undefined" || window.location.pathname === "/email-required") return;

  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== apiSessionQueryKey[0],
  });

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  navigate(`/email-required?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          if (isEmailVerificationRequiredError(error)) {
            redirectToEmailRequired(client, navigate);
          }
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          if (isEmailVerificationRequiredError(error)) {
            redirectToEmailRequired(client, navigate);
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
      <AccentColorProvider>
        <QueryClientProvider client={queryClient}>
          <ApiSessionProvider>
            <TelegramMiniAppBootstrap>
              <ThemeClassSync />
              <div className="pull-to-refresh-content">
                <PullToRefresh />
                {children}
                <Toaster />
                <SpeedInsights />
              </div>
              <ServiceWorkerRegistration />
            </TelegramMiniAppBootstrap>
          </ApiSessionProvider>
        </QueryClientProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}
