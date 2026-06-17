"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { AppearanceSettings } from "@/modules/auth/components/appearance-settings";
import { UserSettingsDialog } from "@/modules/auth/components/user-settings-dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { signOut, useSession } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";

import { WorkspaceDropdown } from "./WorkspaceDropdown";

export function BurgerMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const handleLogout = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  };

  const telegramName = session?.user?.telegram.username
    ? `@${session.user.telegram.username}`
    : session?.user?.telegram.displayName;
  const displayName = session?.user?.name || session?.user?.email || telegramName || "User";
  const email = session?.user?.email;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Открыть меню пользователя"
          className="md:hidden p-0 size-9 rounded-full"
          onClick={() => setOpen(true)}
        >
          <UserAvatar name={session?.user?.name || telegramName} email={email} image={session?.user?.image} size="lg" />
        </Button>
        <SheetContent side="right" showCloseButton={false} className="w-[calc(100vw-48px)] max-w-sm p-0">
          <SheetTitle className="sr-only">Меню пользователя</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="px-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setSettingsDialogOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
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
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 mt-4">
              <WorkspaceDropdown
                currentWorkspaceId={workspaceId}
                variant="list"
                onWorkspaceSelect={() => setOpen(false)}
              />
            </div>

            <div className="px-4 mt-6">
              <AppearanceSettings title="Интерфейс" description={null} className="space-y-3" />
            </div>

            <div className="mt-auto border-t p-4 space-y-1">
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                )}
              >
                <LogOut className="h-5 w-5" />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <UserSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </>
  );
}
