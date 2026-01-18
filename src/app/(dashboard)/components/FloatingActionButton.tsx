"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { CreateTransactionDialog } from "@/modules/transactions/components/CreateTransactionDialog";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";

export function FloatingActionButton() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const createTransactionDialog = useDialogState();

  if (!workspaceId) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => createTransactionDialog.openDialog(null)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>
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
