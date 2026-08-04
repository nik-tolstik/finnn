import { useQuery } from "@tanstack/react-query";

import { useDialogState } from "@/shared/hooks/useDialogState";
import { debtKeys } from "@/shared/lib/query-keys";
import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { getDebts } from "../../debt.api";
import { DebtStatus } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";
import { DebtCard } from "../debt-card/DebtCard";
import { DebtDialog } from "../debt-dialog/DebtDialog";

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
  const debtDialog = useDialogState<DebtWithRelations>();

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
    debtDialog.openDialog(debt);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogWindow
          className="sm:max-h-[82dvh] sm:w-[560px]"
          dismissOnOutsidePress={!debtDialog.mounted}
          onCloseComplete={onCloseComplete}
        >
          <DialogHeader>
            <DialogTitle>История закрытых долгов</DialogTitle>
          </DialogHeader>
          <DialogContent className="min-h-0 overflow-y-auto">
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

      {debtDialog.mounted && debtDialog.data && (
        <DebtDialog
          debt={debtDialog.data}
          workspaceId={workspaceId}
          open={debtDialog.open}
          onOpenChange={debtDialog.closeDialog}
          onCloseComplete={debtDialog.unmountDialog}
        />
      )}
    </>
  );
}
