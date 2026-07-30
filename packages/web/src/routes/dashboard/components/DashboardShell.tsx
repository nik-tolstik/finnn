import { lazy, type ReactNode, Suspense } from "react";

import { cn } from "@/shared/utils/cn";
import { useUIStore } from "@/stores/ui-store";

import { useDesktopViewport } from "./useDesktopViewport";

const Sidebar = lazy(() => import("./Sidebar").then((module) => ({ default: module.Sidebar })));
const Header = lazy(() => import("./Header").then((module) => ({ default: module.Header })));
const MobileDashboardNavigation = lazy(() =>
  import("./MobileDashboardNavigation").then((module) => ({ default: module.MobileDashboardNavigation }))
);

function MobileHeaderFallback() {
  return (
    <div aria-hidden="true" className="sticky top-0 z-20 flex h-16 items-center justify-end bg-background px-4 sm:px-8">
      <div className="size-9 rounded-full bg-muted animate-pulse" />
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const desktopViewport = useDesktopViewport();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <div className="min-h-screen">
      {desktopViewport ? (
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      ) : null}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding-left] duration-200",
          sidebarOpen ? "md:pl-64" : "md:pl-[72px]"
        )}
      >
        {desktopViewport ? null : (
          <Suspense fallback={<MobileHeaderFallback />}>
            <Header />
          </Suspense>
        )}
        <main className="flex-1 px-4 pb-20 md:p-8">{children}</main>
        {desktopViewport ? null : (
          <Suspense fallback={null}>
            <MobileDashboardNavigation />
          </Suspense>
        )}
      </div>
    </div>
  );
}
