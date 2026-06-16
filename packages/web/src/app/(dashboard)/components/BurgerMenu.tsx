"use client";

import { Grip, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AppearanceSettings } from "@/modules/auth/components/appearance-settings";
import { UserSettingsDialog } from "@/modules/auth/components/user-settings-dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { useSession } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";

import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav";

export function BurgerMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";

  const telegramName = session?.user?.telegram.username
    ? `@${session.user.telegram.username}`
    : session?.user?.telegram.displayName;
  const displayName = session?.user?.name || session?.user?.email || telegramName || "User";
  const email = session?.user?.email;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button variant="ghost" size="icon" className="md:hidden p-0 size-6" onClick={() => setOpen(true)}>
          <Grip className="size-5" />
        </Button>
        <SheetContent side="left" className="w-full max-w-full p-0">
          <SheetTitle className="sr-only">Меню навигации</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="px-4 mt-10">
              <div className="flex items-center gap-3 p-2 border rounded-lg">
                <UserAvatar
                  name={session?.user?.name || telegramName}
                  email={email}
                  image={session?.user?.image}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{displayName}</div>
                  {email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
                </div>
              </div>
            </div>

            <div className="px-4 mt-4">
              <div className="rounded-lg border p-3">
                <AppearanceSettings title="Тема" description={null} className="space-y-2" />
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {DASHBOARD_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    href={`${item.href}${basePath}`}
                    key={item.href}
                    prefetch
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto border-t p-4 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSettingsDialogOpen(true);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-3"
                )}
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span>Настройки</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <UserSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </>
  );
}
