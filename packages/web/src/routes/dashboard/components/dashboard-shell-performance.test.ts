import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readComponent = (name: string) =>
  readFileSync(join(process.cwd(), "src/routes/dashboard/components", name), "utf8");

describe("dashboard shell performance boundaries", () => {
  it("loads only the chrome used by the current responsive breakpoint", () => {
    const shellSource = readComponent("DashboardShell.tsx");
    const viewportSource = readComponent("useDesktopViewport.ts");

    expect(shellSource).toContain('lazy(() => import("./Sidebar")');
    expect(shellSource).toContain('import("./MobileDashboardNavigation")');
    expect(shellSource).toContain('lazy(() => import("./Header")');
    expect(shellSource).not.toContain('import { Sidebar } from "./Sidebar"');
    expect(shellSource).not.toContain('import { MobileDashboardNavigation } from "./MobileDashboardNavigation"');
    expect(viewportSource).toContain('"(min-width: 768px)"');
    expect(viewportSource).toContain('addEventListener("change"');
  });

  it("keeps primary mobile interactions instant while deferring secondary dialogs", () => {
    const menuSource = readComponent("MobileUserMenu.tsx");
    const menuContentSource = readComponent("MobileUserMenuContent.tsx");
    const navigationSource = readComponent("MobileDashboardNavigation.tsx");
    const sidebarSource = readComponent("Sidebar.tsx");

    expect(menuSource).toContain('import { MobileUserMenuContent } from "./MobileUserMenuContent"');
    expect(menuSource).toContain('import("@/modules/auth/components/user-settings-dialog")');
    expect(menuSource).toContain('from "@/modules/accounts/components/category-settings-dialog"');
    expect(menuSource).toContain("useCategorySettingsPreload(workspaceId)");
    expect(menuSource).not.toContain('from "./WorkspaceDropdown"');
    expect(menuContentSource).toContain('from "./WorkspaceDropdown"');

    expect(navigationSource).toContain(
      'import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog"'
    );
    expect(navigationSource).toContain('import("@/modules/debts/components/create-debt-dialog")');
    expect(navigationSource).toContain(
      'import("@/modules/scheduled-payments/components/CreateScheduledPaymentDialog")'
    );
    expect(sidebarSource).toContain('import("@/modules/auth/components/user-settings-dialog")');
    expect(sidebarSource).toContain('from "@/modules/accounts/components/category-settings-dialog"');
    expect(sidebarSource).toContain("useCategorySettingsPreload(workspaceId)");
  });

  it("uses CSS state for the mobile navigation without layout measurement or motion runtime", () => {
    const navigationSource = readComponent("MobileDashboardNavigation.tsx");

    expect(navigationSource).toContain('isActive ? "page" : undefined');
    expect(navigationSource).toContain('"bg-primary text-primary-foreground shadow-sm"');
    expect(navigationSource).not.toContain("motion/react");
    expect(navigationSource).not.toContain("getBoundingClientRect");
    expect(navigationSource).not.toContain("ResizeObserver");
    expect(navigationSource).not.toContain("useLayoutEffect");
  });
});
