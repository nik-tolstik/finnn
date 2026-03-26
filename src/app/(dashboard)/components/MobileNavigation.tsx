"use client";

import { HandCoins, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

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
  const debtsPath = "/debts";

  const isAccountsActive = pathname === accountsPath;
  const isDebtsActive = pathname === debtsPath;

  const basePath = `?workspaceId=${workspaceId}`;

  return (
    <>
      <nav className="fixed -bottom-px left-0 right-0 z-50 border-t bg-background md:hidden pb-3">
        <div className="flex items-center justify-around">
          <Link
            href={`${accountsPath}${basePath}`}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors size-16 py-3",
              isAccountsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Wallet className="size-5" />
            <span className="text-xs">Счета</span>
          </Link>
          <button
            type="button"
            onClick={() => createTransactionDialog.openDialog(null)}
            className="flex flex-col items-center justify-center gap-1 transition-colors size-16 py-3 relative"
          >
            <div className="absolute size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 top-0 left-1/2 -translate-x-1/2 -translate-y-1/4">
              <Plus className="size-5" />
            </div>
            <span className="text-xs mt-auto">Создать</span>
          </button>
          <Link
            href={`${debtsPath}${basePath}`}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors size-16 py-3",
              isDebtsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <HandCoins className="size-5" />
            <span className="text-xs">Долги</span>
          </Link>
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
