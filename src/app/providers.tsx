"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { PullToRefresh } from "@/shared/components/PullToRefresh";
import { ServiceWorkerRegistration } from "@/shared/components/ServiceWorkerRegistration";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            refetchInterval: 5000,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <PullToRefresh>{children}</PullToRefresh>
          <ServiceWorkerRegistration />
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
