import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";
import { useUIStore } from "@/stores/ui-store";

import { Header } from "./Header";
import { MobileDashboardNavigation } from "./MobileDashboardNavigation";
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
        <Header />
        <main className="flex-1 px-4 pb-20 md:p-8">{children}</main>
        <MobileDashboardNavigation />
      </div>
    </div>
  );
}
