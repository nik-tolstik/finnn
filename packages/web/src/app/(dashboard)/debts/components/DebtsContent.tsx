"use client";

import { History } from "lucide-react";

import { ClosedDebtsHistoryDialog } from "@/modules/debts/components/closed-debts-history-dialog";
import { DebtsList } from "@/modules/debts/components/debts-list";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";

interface DebtsContentProps {
  workspaceId: string;
}

export function DebtsContent({ workspaceId }: DebtsContentProps) {
  const historyDialog = useDialogState();

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-6">
        <div className="flex gap-3 items-center justify-between">
          <h1 className="text-2xl font-semibold">Долги</h1>
          <Button
            aria-label="История закрытых долгов"
            variant="ghost"
            size="icon"
            onClick={() => historyDialog.openDialog(null)}
          >
            <History className="size-4" />
          </Button>
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
    </div>
  );
}
