"use client";

import { Plus, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

import { CreateTransactionDialog } from "@/modules/transactions/components/CreateTransactionDialog";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { cn } from "@/shared/utils/cn";

export function MobileNavigation() {
  const { isMobile } = useBreakpoints();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const createTransactionDialog = useDialogState();

  if (!isMobile || !workspaceId) {
    return null;
  }

  const accountsPath = "/dashboard";
  const analyticsPath = "/analytics";

  const isAccountsActive = pathname === accountsPath;
  const isAnalyticsActive = pathname === analyticsPath;

  const basePath = `?workspaceId=${workspaceId}`;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
        <div className="flex h-16 items-center justify-around">
          <Link
            href={`${accountsPath}${basePath}`}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              isAccountsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs">Счета</span>
          </Link>
          <button
            onClick={() => createTransactionDialog.openDialog(null)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            <Plus className="h-6 w-6" />
          </button>
          <Link
            href={`${analyticsPath}${basePath}`}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              isAnalyticsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Аналитика</span>
          </Link>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground opacity-50">
            <div className="h-5 w-5" />
            <span className="text-xs">—</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground opacity-50">
            <div className="h-5 w-5" />
            <span className="text-xs">—</span>
          </div>
        </div>
      </nav>
      {createTransactionDialog.mounted && workspaceId && (
        <CreateTransactionDialog
          workspaceId={workspaceId}
          open={createTransactionDialog.open}
          onOpenChange={createTransactionDialog.closeDialog}
          onCloseComplete={createTransactionDialog.unmountDialog}
        />
      )}
    </>
  );
}
