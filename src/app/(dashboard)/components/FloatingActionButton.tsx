"use client";

import { Plus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { CreateDebtDialog } from "@/modules/debts/components/CreateDebtDialog";
import { CreateTransactionDialog } from "@/modules/transactions/components/CreateTransactionDialog";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";

export function FloatingActionButton() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const createTransactionDialog = useDialogState();
  const createDebtDialog = useDialogState();

  if (!workspaceId) {
    return null;
  }

  const isDebtsPage = pathname === "/debts";

  const handleClick = () => {
    if (isDebtsPage) {
      createDebtDialog.openDialog(null);
    } else {
      createTransactionDialog.openDialog(null);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>
      {createTransactionDialog.mounted && workspaceId && !isDebtsPage && (
        <CreateTransactionDialog
          workspaceId={workspaceId}
          open={createTransactionDialog.open}
          onOpenChange={createTransactionDialog.closeDialog}
          onCloseComplete={createTransactionDialog.unmountDialog}
        />
      )}
      {createDebtDialog.mounted && workspaceId && isDebtsPage && (
        <CreateDebtDialog
          workspaceId={workspaceId}
          open={createDebtDialog.open}
          onOpenChange={createDebtDialog.closeDialog}
          onCloseComplete={createDebtDialog.unmountDialog}
        />
      )}
    </>
  );
}
