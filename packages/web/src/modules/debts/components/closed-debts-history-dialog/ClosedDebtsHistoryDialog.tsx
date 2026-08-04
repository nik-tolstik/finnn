import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRef } from "react";

import { useDialogState } from "@/shared/hooks/useDialogState";
import { debtKeys } from "@/shared/lib/query-keys";
import { ActionsDialog } from "@/shared/ui/actions-dialog";
import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { formatMoney } from "@/shared/utils/money";

import { getDebts } from "../../debt.api";
import { DebtStatus } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";
import { DebtCard } from "../debt-card/DebtCard";
import { DeleteDebtDialog } from "../delete-debt-dialog/DeleteDebtDialog";

type ClosedDebtActionsDialogData = {
  anchor: HTMLElement;
  debt: DebtWithRelations;
};

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
  const actionsDialog = useDialogState<ClosedDebtActionsDialogData>();
  const deleteDialog = useDialogState<DebtWithRelations>();
  const pendingDeleteDebtRef = useRef<DebtWithRelations | null>(null);

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

  const handleDebtClick = (debt: DebtWithRelations, anchor?: HTMLElement) => {
    if (!anchor) return;
    actionsDialog.openDialog({ anchor, debt });
  };

  const handleDeleteAction = () => {
    if (!actionsDialog.data) return;
    pendingDeleteDebtRef.current = actionsDialog.data.debt;
    actionsDialog.closeDialog();
  };

  const handleActionsCloseComplete = () => {
    actionsDialog.unmountDialog();

    const debt = pendingDeleteDebtRef.current;
    pendingDeleteDebtRef.current = null;
    if (debt) {
      deleteDialog.openDialog(debt);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogWindow
          className="sm:max-h-[82dvh] sm:w-[560px]"
          dismissOnEscapeKey={!actionsDialog.mounted && !deleteDialog.mounted}
          dismissOnOutsidePress={!actionsDialog.mounted && !deleteDialog.mounted}
          onCloseComplete={onCloseComplete}
        >
          <DialogHeader>
            <DialogTitle>История закрытых долгов</DialogTitle>
          </DialogHeader>
          <DialogContent className="min-h-0 overflow-y-auto pb-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
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
                    <DebtCard debt={debt} onClick={(anchor) => handleDebtClick(debt, anchor)} />
                  </AnimatedListItem>
                ))}
              </div>
            )}
          </DialogContent>
        </DialogWindow>
      </Dialog>

      {actionsDialog.mounted && actionsDialog.data ? (
        <ActionsDialog
          anchor={actionsDialog.data.anchor}
          open={actionsDialog.open}
          onCloseComplete={handleActionsCloseComplete}
          onOpenChange={actionsDialog.closeDialog}
          actions={[
            {
              id: "delete",
              icon: <Trash2 />,
              label: "Удалить",
              onSelect: handleDeleteAction,
              tone: "destructive",
            },
          ]}
          mobileContext={
            <span className="mt-1 flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate">{actionsDialog.data.debt.personName}</span>
              <span className="shrink-0">
                {formatMoney(actionsDialog.data.debt.amount, actionsDialog.data.debt.currency)}
              </span>
            </span>
          }
        />
      ) : null}

      {deleteDialog.mounted && deleteDialog.data ? (
        <DeleteDebtDialog
          debt={deleteDialog.data}
          workspaceId={workspaceId}
          open={deleteDialog.open}
          onOpenChange={deleteDialog.closeDialog}
          onCloseComplete={deleteDialog.unmountDialog}
        />
      ) : null}
    </>
  );
}
