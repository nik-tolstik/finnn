import type { ReactNode } from "react";
import { Suspense } from "react";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";

import { DashboardAuthGate } from "./components/DashboardAuthGate";
import { DashboardShell } from "./components/DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <DashboardAuthGate>
        <DashboardShell>{children}</DashboardShell>
      </DashboardAuthGate>
    </Suspense>
  );
}
