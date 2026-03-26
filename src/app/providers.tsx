"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { ServiceWorkerRegistration } from "@/shared/components/ServiceWorkerRegistration";

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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <ThemeClassSync />
          {children}
          <ServiceWorkerRegistration />
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
