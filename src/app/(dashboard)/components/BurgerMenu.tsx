"use client";

import { Grip, HandCoins, LogOut, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

import { AppearanceSettings } from "@/modules/auth/components/AppearanceSettings";
import { UserSettingsDialog } from "@/modules/auth/components/UserSettingsDialog";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { getAvatarColor } from "@/shared/utils/avatar-colors";
import { cn } from "@/shared/utils/cn";

export function BurgerMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";

  const accountsPath = "/dashboard";
  const debtsPath = "/debts";

  const isAccountsActive = pathname === accountsPath;
  const isDebtsActive = pathname === debtsPath;

  const handleLogout = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  };

  const displayName = session?.user?.name || session?.user?.email || "User";
  const email = session?.user?.email;
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden p-0 size-6">
            <Grip className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full max-w-full p-0">
          <SheetTitle className="sr-only">Меню навигации</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="px-4 mt-10">
              <div className="flex items-center gap-3 p-2 border rounded-lg">
                <div
                  className="flex size-8 items-center justify-center rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: getAvatarColor(displayName) }}
                >
                  {avatarInitial}
                </div>
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
              <Link
                href={`${accountsPath}${basePath}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isAccountsActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                )}
              >
                <Wallet className="h-5 w-5" />
                <span>Счета</span>
              </Link>
              <Link
                href={`${debtsPath}${basePath}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isDebtsActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                )}
              >
                <HandCoins className="h-5 w-5" />
                <span>Долги</span>
              </Link>
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
              <button
                type="button"
                onClick={handleLogout}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-3"
                )}
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
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
