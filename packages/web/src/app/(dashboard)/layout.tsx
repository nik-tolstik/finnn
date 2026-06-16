import type { ReactNode } from "react";

import { DashboardAuthGate } from "./components/DashboardAuthGate";
import { DashboardShell } from "./components/DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardAuthGate>
      <DashboardShell>{children}</DashboardShell>
    </DashboardAuthGate>
  );
}
