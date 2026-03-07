"use client";

import { Grip, HandCoins, LogOut, Settings, TrendingUp, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { UserSettingsDialog } from "@/modules/auth/components/UserSettingsDialog";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
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
  const analyticsPath = "/analytics";
  const debtsPath = "/debts";

  const isAccountsActive = pathname === accountsPath;
  const isAnalyticsActive = pathname === analyticsPath;
  const isDebtsActive = pathname === debtsPath;

  const handleLogout = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  };

  const displayName = session?.user?.name || session?.user?.email || "User";
  const email = session?.user?.email;
  const image = session?.user?.image;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
                {image ? (
                  <Image
                    src={image}
                    alt={displayName}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-medium">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{displayName}</div>
                  {email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <Link
                href={`${accountsPath}${basePath}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isAccountsActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                )}
              >
                <Wallet className="h-5 w-5" />
                <span>Счета</span>
              </Link>
              <Link
                href={`${analyticsPath}${basePath}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isAnalyticsActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                )}
              >
                <TrendingUp className="h-5 w-5" />
                <span>Аналитика</span>
              </Link>
              <Link
                href={`${debtsPath}${basePath}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isDebtsActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                )}
              >
                <HandCoins className="h-5 w-5" />
                <span>Долги</span>
              </Link>
            </nav>

            <div className="mt-auto border-t p-4 space-y-1">
              <button
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
