"use client";

import { useQuery } from "@tanstack/react-query";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { AnimatedListItem } from "@/shared/ui/animated-list";

import { getDebts } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";

import { AddToDebtDialog } from "./AddToDebtDialog";
import { CloseDebtDialog } from "./CloseDebtDialog";
import { DebtActionsDialog } from "./DebtActionsDialog";
import { DebtCard } from "./DebtCard";
import { DeleteDebtDialog } from "./DeleteDebtDialog";

interface DebtsListProps {
  workspaceId: string;
}

export function DebtsList({ workspaceId }: DebtsListProps) {
  const { isMobile } = useBreakpoints();
  const actionsDialog = useDialogState<DebtWithRelations>();
  const closeDialog = useDialogState<DebtWithRelations>();
  const addMoreDialog = useDialogState<DebtWithRelations>();
  const deleteDialog = useDialogState<DebtWithRelations>();

  const { data, isLoading } = useQuery({
    queryKey: ["debts", workspaceId],
    queryFn: () => getDebts(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const debts = data?.data || [];

  const handleDebtClick = (debt: DebtWithRelations) => {
    actionsDialog.openDialog(debt);
  };

  const handleClose = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        closeDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  const handleAddMore = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        addMoreDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  const handleDelete = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        deleteDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Долгов пока нет</p>
        <p className="text-sm mt-1">
          {isMobile
            ? "Создайте первый долг, нажав кнопку с плюсиком внизу справа"
            : "Создайте первый долг, нажав кнопку выше"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {debts.map((debt) => (
          <AnimatedListItem key={debt.id}>
            <DebtCard debt={debt} onClick={() => handleDebtClick(debt)} />
          </AnimatedListItem>
        ))}
      </div>

      {actionsDialog.mounted && actionsDialog.data && (
        <DebtActionsDialog
          debt={actionsDialog.data}
          open={actionsDialog.open}
          onOpenChange={actionsDialog.closeDialog}
          onCloseComplete={actionsDialog.unmountDialog}
          onClose={handleClose}
          onAddMore={handleAddMore}
          onDelete={handleDelete}
        />
      )}

      {closeDialog.mounted && closeDialog.data && (
        <CloseDebtDialog
          debt={closeDialog.data}
          workspaceId={workspaceId}
          open={closeDialog.open}
          onOpenChange={closeDialog.closeDialog}
          onCloseComplete={closeDialog.unmountDialog}
        />
      )}

      {addMoreDialog.mounted && addMoreDialog.data && (
        <AddToDebtDialog
          debt={addMoreDialog.data}
          workspaceId={workspaceId}
          open={addMoreDialog.open}
          onOpenChange={addMoreDialog.closeDialog}
          onCloseComplete={addMoreDialog.unmountDialog}
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
