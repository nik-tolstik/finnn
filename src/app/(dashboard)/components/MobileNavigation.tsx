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
        <div className="flex items-center justify-around py-2">
          <Link
            href={`${accountsPath}${basePath}`}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors size-16",
              isAccountsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Wallet className="size-5" />
            <span className="text-xs">Счета</span>
          </Link>
          <Link
            href={`${analyticsPath}${basePath}`}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors size-16",
              isAnalyticsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <TrendingUp className="size-5" />
            <span className="text-xs">Аналитика</span>
          </Link>
          <button
            onClick={() => createTransactionDialog.openDialog(null)}
            className="flex items-center justify-center rounded-full bg-primary text-primary-foreground size-12"
          >
            <Plus className="size-6" />
          </button>
          <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-50 size-16">
            <div className="size-5" />
            <span className="text-xs">—</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-50 size-16">
            <div className="size-5" />
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
