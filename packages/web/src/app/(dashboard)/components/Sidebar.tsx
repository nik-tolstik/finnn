"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppearanceSettings } from "@/modules/auth/components/appearance-settings";
import { UserSettingsDialog } from "@/modules/auth/components/user-settings-dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { signOut, useSession } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Tooltip, type TooltipProps } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { useUIStore } from "@/stores/ui-store";

import { CurrencyFlag, DashboardExchangeRatesList, useDashboardExchangeRates } from "./dashboard-exchange-rates";
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
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
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

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

        <div className="flex-1 px-4 py-2">
          <nav className="space-y-1">
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

          <div className="mt-4 border-t pt-4">
            <WorkspaceDropdown
              className={cn(sidebarOpen ? "w-full justify-start" : "mx-auto")}
              collapsed={!sidebarOpen}
              currentWorkspaceId={workspaceId}
              placement={sidebarOpen ? "bottom-start" : "right-start"}
            />
          </div>
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
              <div className="flex w-10 flex-col items-center gap-1.5 px-0 py-1">
                {isExchangeRatesLoading ? (
                  <>
                    <div className="h-3 w-8 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-8 rounded bg-muted animate-pulse" />
                  </>
                ) : (
                  exchangeRates.map((rate) => (
                    <div
                      className="flex w-full flex-col items-center justify-center gap-1 text-[10px] font-medium leading-tight tabular-nums text-foreground"
                      key={rate.currency}
                    >
                      <CurrencyFlag className="size-3.5" code={rate.flagCode} label={rate.flagLabel} />
                      <span>{rate.shortValue}</span>
                    </div>
                  ))
                )}
              </div>
            ))}

          <div className="relative" ref={userMenuRef}>
            <SidebarIconTooltip content="Меню пользователя" disabled={sidebarOpen || userMenuOpen}>
              <button
                type="button"
                aria-label="Открыть меню пользователя"
                aria-expanded={userMenuOpen}
                data-state={userMenuOpen ? "open" : "closed"}
                onClick={() => setUserMenuOpen((open) => !open)}
                className={cn(
                  "flex w-full items-center rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
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

            {userMenuOpen && (
              <div className="absolute bottom-0 left-full z-50 ml-2 w-72 rounded-md border bg-card p-2 text-card-foreground shadow-md">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSettingsDialogOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <UserRound className="size-4 text-muted-foreground" />
                    <span>Профиль</span>
                  </button>
                </div>
                <div className="px-2 py-2">
                  <AppearanceSettings title="Интерфейс" description={null} className="space-y-2" showLabels={false} />
                </div>
                <div className="border-t pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="size-4" />
                    <span>Выйти</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <UserSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </>
  );
}
