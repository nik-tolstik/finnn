import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useLayoutEffect, useState } from "react";
import { type NavigateFunction, useNavigate } from "react-router";

import { TelegramMiniAppBootstrap } from "@/modules/telegram-mini/TelegramMiniAppBootstrap";
import { isEmailVerificationRequiredError } from "@/shared/api/http-client";
import { AccentColorProvider } from "@/shared/components/accent-color-provider";
import { PullToRefresh } from "@/shared/components/pull-to-refresh";
import { ServiceWorkerRegistration } from "@/shared/components/ServiceWorkerRegistration";
import { ApiSessionProvider, apiSessionQueryKey } from "@/shared/lib/api-session";
import { ThemeProvider, useTheme } from "@/shared/lib/theme-context";
import { getThemeLogoPath } from "@/shared/lib/theme-logo";
import { Toaster } from "@/shared/ui/sonner";

function ThemeClassSync() {
  const { resolvedTheme } = useTheme();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const transitionBlocker = document.createElement("style");
    transitionBlocker.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(transitionBlocker);

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    const faviconUrl = getThemeLogoPath(resolvedTheme);

    if (faviconUrl) {
      const faviconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');

      for (const link of faviconLinks) {
        link.href = faviconUrl;
        link.type = "image/svg+xml";
        link.sizes = "any";
        link.media = "";
      }
    }

    void window.getComputedStyle(root).color;
    const timeoutId = window.setTimeout(() => transitionBlocker.remove(), 0);

    return () => {
      window.clearTimeout(timeoutId);
      transitionBlocker.remove();
    };
  }, [resolvedTheme]);

  return null;
}

function redirectToEmailRequired(queryClient: QueryClient, navigate: NavigateFunction): void {
  if (window.location.pathname === "/email-required") return;

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
    <ThemeProvider>
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
