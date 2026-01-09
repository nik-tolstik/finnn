"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TrendingUp, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { cn } from "@/shared/utils/cn";
import { getWorkspace } from "@/modules/workspace/workspace.service";

import { UserMenu } from "./UserMenu";
import { WorkspaceDropdown } from "./WorkspaceDropdown";
import { ExchangeRatesHeader } from "./ExchangeRatesHeader";

export function Header() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isMobile } = useBreakpoints();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => (workspaceId ? getWorkspace(workspaceId) : null),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? workspaceData.data.baseCurrency || "BYN"
      : "BYN";

  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";

  const accountsPath = "/dashboard";
  const analyticsPath = "/analytics";

  const isAccountsActive = pathname === accountsPath;
  const isAnalyticsActive = pathname === analyticsPath;

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <WorkspaceDropdown currentWorkspaceId={workspaceId} />
          {!isMobile && (
            <nav className="flex items-center gap-1 ml-4">
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
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ExchangeRatesHeader baseCurrency={baseCurrency} />
          {session?.user && <UserMenu name={session.user.name} email={session.user.email} image={session.user.image} />}
        </div>
      </div>
    </header>
  );
}
