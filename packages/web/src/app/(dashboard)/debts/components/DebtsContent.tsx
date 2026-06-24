"use client";

import { History, Plus } from "lucide-react";

import { ClosedDebtsHistoryDialog } from "@/modules/debts/components/closed-debts-history-dialog";
import { CreateDebtDialog } from "@/modules/debts/components/create-debt-dialog";
import { DebtsList } from "@/modules/debts/components/debts-list";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";

interface DebtsContentProps {
  workspaceId: string;
}

export function DebtsContent({ workspaceId }: DebtsContentProps) {
  const historyDialog = useDialogState();
  const createDebtDialog = useDialogState();

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-2xl font-semibold">Долги</h1>
          <div className="flex items-center gap-2">
            <Button
              aria-label="История закрытых долгов"
              variant="ghost"
              size="icon"
              onClick={() => historyDialog.openDialog(null)}
            >
              <History className="size-4" />
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => createDebtDialog.openDialog(null)}>
              <Plus className="size-4" />
              Создать долг
            </Button>
          </div>
        </div>

        <DebtsList workspaceId={workspaceId} />
      </div>

      {historyDialog.mounted && (
        <ClosedDebtsHistoryDialog
          workspaceId={workspaceId}
          open={historyDialog.open}
          onOpenChange={historyDialog.closeDialog}
          onCloseComplete={historyDialog.unmountDialog}
        />
      )}

      {createDebtDialog.mounted && (
        <CreateDebtDialog
          workspaceId={workspaceId}
          open={createDebtDialog.open}
          onOpenChange={createDebtDialog.closeDialog}
          onCloseComplete={createDebtDialog.unmountDialog}
        />
      )}
    </div>
  );
}
