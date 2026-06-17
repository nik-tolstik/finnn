"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { cn } from "@/shared/utils/cn";
import { useUIStore } from "@/stores/ui-store";

import { ExchangeRatesTicker } from "./ExchangeRatesTicker";
import { FloatingActionButton } from "./FloatingActionButton";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding-left] duration-200",
          sidebarOpen ? "md:pl-64" : "md:pl-[72px]"
        )}
      >
        <Suspense
          fallback={
            <div className="h-8 bg-muted/50 border-b">
              <div className="flex items-center h-full px-4 sm:px-8">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          }
        >
          <ExchangeRatesTicker />
        </Suspense>
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main className="flex-1 px-4 pb-20 md:p-8">{children}</main>
        <Suspense fallback={null}>
          <FloatingActionButton />
        </Suspense>
      </div>
    </div>
  );
}
