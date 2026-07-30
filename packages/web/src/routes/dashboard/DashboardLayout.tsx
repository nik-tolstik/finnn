import { Outlet } from "react-router";

import { DashboardAuthGate } from "./components/DashboardAuthGate";
import { DashboardShell } from "./components/DashboardShell";

export default function DashboardLayout() {
  return (
    <DashboardAuthGate>
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </DashboardAuthGate>
  );
}
