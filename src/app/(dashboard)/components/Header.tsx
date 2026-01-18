"use client";

import { TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/shared/utils/cn";

import { BurgerMenu } from "./BurgerMenu";
import { UserMenu } from "./UserMenu";
import { WorkspaceDropdown } from "./WorkspaceDropdown";

export function Header() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";

  const accountsPath = "/dashboard";
  const analyticsPath = "/analytics";

  const isAccountsActive = pathname === accountsPath;
  const isAnalyticsActive = pathname === analyticsPath;

  return (
    <header className="border-b bg-background py-2 sticky top-0 z-20 h-16 flex items-center">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center gap-4 flex-1">
          <BurgerMenu />
          <div className="hidden md:block text-2xl font-bold text-white">FinHub</div>
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
              href={`${analyticsPath}${basePath}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isAnalyticsActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Аналитика</span>
            </Link>

            <WorkspaceDropdown currentWorkspaceId={workspaceId} />
          </nav>

          <WorkspaceDropdown currentWorkspaceId={workspaceId} className="md:hidden ml-auto" />
        </div>
        <div className="items-center gap-4 hidden md:flex">
          {session?.user && <UserMenu name={session.user.name} email={session.user.email} image={session.user.image} />}
        </div>
      </div>
    </header>
  );
}
