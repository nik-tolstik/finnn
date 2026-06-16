"use client";

import { PanelLeftClose, PanelLeftOpen, SunMoon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AppearanceSettings } from "@/modules/auth/components/appearance-settings";
import { UserSettingsDialog } from "@/modules/auth/components/user-settings-dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { useSession } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Popover } from "@/shared/ui/popover";
import { Tooltip, type TooltipProps } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { useUIStore } from "@/stores/ui-store";

import { DashboardExchangeRatesList, useDashboardExchangeRates } from "./dashboard-exchange-rates";
import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav";
import { WorkspaceDropdown } from "./WorkspaceDropdown";

function getDisplayName(session: ReturnType<typeof useSession>["data"]) {
  const telegramName = session?.user?.telegram.username
    ? `@${session.user.telegram.username}`
    : session?.user?.telegram.displayName;

  return {
    displayName: session?.user?.name || session?.user?.email || telegramName || "User",
    email: session?.user?.email,
    telegramName,
  };
}

interface SidebarIconTooltipProps {
  children: TooltipProps["children"];
  content: string;
  disabled: boolean;
}

function SidebarIconTooltip({ children, content, disabled }: SidebarIconTooltipProps) {
  return (
    <Tooltip content={content} delayDuration={0} disabled={disabled} side="right">
      {children}
    </Tooltip>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";
  const { displayName, email, telegramName } = getDisplayName(session);
  const {
    isLoading: isExchangeRatesLoading,
    rates: exchangeRates,
    shouldRender: shouldRenderExchangeRates,
  } = useDashboardExchangeRates(workspaceId);
  const shouldShowExchangeRates = isExchangeRatesLoading || shouldRenderExchangeRates;

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col border-r bg-background transition-[width] duration-200 md:flex",
          sidebarOpen ? "w-64" : "w-[72px]"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Link
            href={`/dashboard${basePath}`}
            aria-label="Finnn dashboard"
            className={cn("flex size-10 items-center justify-center rounded-md", !sidebarOpen && "mx-auto")}
          >
            <Image src="/logo-dark.svg" alt="" width={32} height={32} className="block dark:hidden" priority />
            <Image src="/logo-light.svg" alt="" width={32} height={32} className="hidden dark:block" priority />
          </Link>
          {sidebarOpen && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Свернуть sidebar" onClick={toggleSidebar}>
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        {!sidebarOpen && (
          <div className="flex justify-center px-4 pb-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Развернуть sidebar"
              onClick={toggleSidebar}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-4 py-2">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <SidebarIconTooltip content={item.label} disabled={sidebarOpen} key={item.href}>
                <Link
                  href={`${item.href}${basePath}`}
                  prefetch
                  aria-label={sidebarOpen ? undefined : item.label}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors",
                    sidebarOpen ? "gap-3 px-3 py-2" : "size-10 justify-center p-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className={cn(sidebarOpen ? "size-4" : "size-5")} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              </SidebarIconTooltip>
            );
          })}
        </nav>

        <div className="px-4 pb-3">
          <WorkspaceDropdown
            className={cn(sidebarOpen ? "w-full justify-start" : "mx-auto")}
            collapsed={!sidebarOpen}
            currentWorkspaceId={workspaceId}
            placement="right-start"
          />
        </div>

        <div className="mt-auto space-y-2 border-t px-4 py-4">
          {shouldShowExchangeRates &&
            (sidebarOpen ? (
              <div className="px-3 py-2">
                {isExchangeRatesLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                  </div>
                ) : (
                  <DashboardExchangeRatesList compact rates={exchangeRates} />
                )}
              </div>
            ) : (
              <div className="flex w-10 flex-col items-center gap-0.5 px-0 py-1">
                {isExchangeRatesLoading ? (
                  <>
                    <div className="h-3 w-8 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-8 rounded bg-muted animate-pulse" />
                  </>
                ) : (
                  exchangeRates.map((rate) => (
                    <div
                      className="flex w-full items-center justify-center gap-0.5 text-xs font-medium leading-5 tabular-nums text-foreground"
                      key={rate.currency}
                    >
                      <span className="text-muted-foreground">{rate.symbol}</span>
                      <span>{rate.value}</span>
                    </div>
                  ))
                )}
              </div>
            ))}

          {sidebarOpen ? (
            <AppearanceSettings title="Тема" description={null} className="space-y-2" showLabels={false} />
          ) : (
            <Popover
              placement="right-end"
              className="w-64 p-3"
              trigger={({ ref, ...triggerProps }) => (
                <SidebarIconTooltip content="Тема" disabled={false}>
                  <button
                    ref={ref}
                    type="button"
                    aria-label="Выбор темы"
                    className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    {...triggerProps}
                  >
                    <SunMoon className="size-5" />
                  </button>
                </SidebarIconTooltip>
              )}
            >
              <AppearanceSettings title="Тема" description={null} className="space-y-2" showLabels={false} />
            </Popover>
          )}

          <SidebarIconTooltip content="Настройки пользователя" disabled={sidebarOpen}>
            <button
              type="button"
              aria-label="Открыть настройки пользователя"
              onClick={() => setSettingsDialogOpen(true)}
              className={cn(
                "flex w-full items-center rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                sidebarOpen ? "gap-3 px-2 py-2" : "size-10 justify-center p-0"
              )}
            >
              <UserAvatar
                name={session?.user?.name || telegramName}
                email={email}
                image={session?.user?.image}
                size={sidebarOpen ? "lg" : "md"}
              />
              {sidebarOpen && (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{displayName}</span>
                  {email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
                </span>
              )}
            </button>
          </SidebarIconTooltip>
        </div>
      </aside>

      <UserSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </>
  );
}
