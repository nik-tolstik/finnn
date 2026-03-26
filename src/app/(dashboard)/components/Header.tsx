"use client";

import { Building2, ChevronDown, Grip, HandCoins, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/shared/utils/cn";

const BurgerMenu = dynamic(() => import("./BurgerMenu").then((mod) => mod.BurgerMenu), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className="inline-flex items-center justify-center rounded-md md:hidden p-0 size-6">
      <Grip className="size-5" />
    </div>
  ),
});

const WorkspaceDropdown = dynamic(() => import("./WorkspaceDropdown").then((mod) => mod.WorkspaceDropdown), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="cursor-default flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground"
    >
      <Building2 className="h-4 w-4" />
      <span className="max-w-[200px] truncate">Workspace</span>
      <ChevronDown className="h-4 w-4" />
    </div>
  ),
});

const UserMenu = dynamic(() => import("./UserMenu").then((mod) => mod.UserMenu), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-8 w-8 rounded-full bg-muted" />,
});

export function Header() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";

  const accountsPath = "/dashboard";
  const debtsPath = "/debts";

  const isAccountsActive = pathname === accountsPath;
  const isDebtsActive = pathname === debtsPath;

  return (
    <header className="border-b bg-background py-2 sticky top-0 z-20 h-16 flex items-center">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center gap-4 flex-1">
          <BurgerMenu />
          <div className="hidden md:flex items-center gap-2">
            <Image src="/logo-light.svg" alt="Finnn" width={32} height={32} />
            <span className="text-2xl font-bold text-white">Finnn</span>
          </div>
          <nav className="hidden md:flex items-center gap-2 ml-4">
            <Link
              href={`${accountsPath}${basePath}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isAccountsActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Wallet className="h-4 w-4" />
              <span>Счета</span>
            </Link>
            <Link
              href={`${debtsPath}${basePath}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isDebtsActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <HandCoins className="h-4 w-4" />
              <span>Долги</span>
            </Link>

            <WorkspaceDropdown currentWorkspaceId={workspaceId} />
          </nav>

          <WorkspaceDropdown currentWorkspaceId={workspaceId} className="md:hidden ml-auto" />
        </div>
        <div className="items-center gap-4 hidden md:flex">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
