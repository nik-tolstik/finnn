"use client";

import { useQuery } from "@tanstack/react-query";

import { useDialogState } from "@/shared/hooks/useDialogState";
import { debtKeys } from "@/shared/lib/query-keys";
import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { DebtStatus } from "../debt.constants";
import { getDebts } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";
import { DebtActionsDialog } from "./DebtActionsDialog";
import { DebtCard } from "./DebtCard";
import { DeleteDebtDialog } from "./DeleteDebtDialog";

interface ClosedDebtsHistoryDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function ClosedDebtsHistoryDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
}: ClosedDebtsHistoryDialogProps) {
  const actionsDialog = useDialogState<DebtWithRelations>();
  const deleteDialog = useDialogState<DebtWithRelations>();

  const debtFilters = {
    status: DebtStatus.CLOSED,
  };

  const { data, isLoading } = useQuery({
    queryKey: debtKeys.list(workspaceId, debtFilters),
    queryFn: () => getDebts(workspaceId, debtFilters),
    enabled: open,
    staleTime: 5000,
  });

  const closedDebts = data?.data || [];

  const handleDebtClick = (debt: DebtWithRelations) => {
    actionsDialog.openDialog(debt);
  };

  const handleDelete = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        deleteDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogWindow onCloseComplete={onCloseComplete} className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>История закрытых долгов</DialogTitle>
          </DialogHeader>
          <DialogContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : closedDebts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Закрытых долгов пока нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {closedDebts.map((debt) => (
                  <AnimatedListItem key={debt.id}>
                    <DebtCard debt={debt} onClick={() => handleDebtClick(debt)} />
                  </AnimatedListItem>
                ))}
              </div>
            )}
          </DialogContent>
        </DialogWindow>
      </Dialog>

      {actionsDialog.mounted && actionsDialog.data && (
        <DebtActionsDialog
          debt={actionsDialog.data}
          open={actionsDialog.open}
          onOpenChange={actionsDialog.closeDialog}
          onCloseComplete={actionsDialog.unmountDialog}
          onClose={() => {}}
          onAddMore={() => {}}
          onDelete={handleDelete}
          onEdit={() => {}}
        />
      )}

      {deleteDialog.mounted && deleteDialog.data && (
        <DeleteDebtDialog
          debt={deleteDialog.data}
          workspaceId={workspaceId}
          open={deleteDialog.open}
          onOpenChange={deleteDialog.closeDialog}
        />
      )}
    </>
  );
}
