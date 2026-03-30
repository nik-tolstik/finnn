"use client";

import { DebtTransactionActionsDialog } from "@/modules/debts/components/debt-transaction-actions-dialog";
import { DeleteDebtDialog } from "@/modules/debts/components/delete-debt-dialog";
import { EditDebtDialog } from "@/modules/debts/components/edit-debt-dialog";
import { EditDebtTransactionDialog } from "@/modules/debts/components/edit-debt-transaction-dialog";

import { CreateTransactionDialog } from "../../create-transaction-dialog/CreateTransactionDialog";
import { EditTransactionDialog } from "../../edit-transaction-dialog/EditTransactionDialog";
import { EditTransferDialog } from "../../edit-transfer-dialog/EditTransferDialog";
import { TransactionActionsDialog } from "../../transaction-actions-dialog/TransactionActionsDialog";
import type { CombinedTransactionsController } from "../hooks/useCombinedTransactionsController";

interface CombinedTransactionsDialogsProps {
  controller: CombinedTransactionsController;
}

export function CombinedTransactionsDialogs({ controller }: CombinedTransactionsDialogsProps) {
  const {
    workspaceId,
    dialogs: {
      editTransactionDialog,
      editTransferDialog,
      editDebtDialog,
      editDebtTransactionDialog,
      deleteDebtDialog,
      actionsDialog,
      debtActionsDialog,
      createTransactionDialog,
    },
    handleTransactionDelete,
    handleTransactionEdit,
    handleTransactionRepeat,
    handleDebtTransactionDelete,
    handleDebtTransactionEdit,
  } = controller;

  return (
    <>
      {actionsDialog.mounted ? (
        <TransactionActionsDialog
          transactionKind={actionsDialog.data.transaction.kind}
          open={actionsDialog.open}
          onOpenChange={actionsDialog.closeDialog}
          onCloseComplete={actionsDialog.unmountDialog}
          onEdit={() => {
            handleTransactionEdit(actionsDialog.data.transaction);
          }}
          onDelete={() => {
            handleTransactionDelete(actionsDialog.data.transaction);
          }}
          onRepeat={() => {
            handleTransactionRepeat(actionsDialog.data.transaction);
          }}
        />
      ) : null}

      {debtActionsDialog.mounted ? (
        <DebtTransactionActionsDialog
          debtTransaction={debtActionsDialog.data.debtTransaction}
          open={debtActionsDialog.open}
          onOpenChange={debtActionsDialog.closeDialog}
          onCloseComplete={debtActionsDialog.unmountDialog}
          onEdit={() => {
            handleDebtTransactionEdit(debtActionsDialog.data.debtTransaction);
          }}
          onDelete={() => {
            handleDebtTransactionDelete(debtActionsDialog.data.debtTransaction);
          }}
        />
      ) : null}

      {editTransactionDialog.mounted ? (
        <EditTransactionDialog
          transaction={editTransactionDialog.data.transaction}
          workspaceId={editTransactionDialog.data.workspaceId}
          open={editTransactionDialog.open}
          onOpenChange={editTransactionDialog.closeDialog}
          onCloseComplete={editTransactionDialog.unmountDialog}
        />
      ) : null}

      {editTransferDialog.mounted ? (
        <EditTransferDialog
          transferTransaction={editTransferDialog.data.transferTransaction}
          workspaceId={editTransferDialog.data.workspaceId}
          open={editTransferDialog.open}
          onOpenChange={editTransferDialog.closeDialog}
          onCloseComplete={editTransferDialog.unmountDialog}
        />
      ) : null}

      {editDebtDialog.mounted ? (
        <EditDebtDialog
          debt={editDebtDialog.data.debt}
          workspaceId={editDebtDialog.data.workspaceId}
          open={editDebtDialog.open}
          onOpenChange={editDebtDialog.closeDialog}
          onCloseComplete={editDebtDialog.unmountDialog}
        />
      ) : null}

      {editDebtTransactionDialog.mounted ? (
        <EditDebtTransactionDialog
          debtTransaction={editDebtTransactionDialog.data.debtTransaction}
          workspaceId={editDebtTransactionDialog.data.workspaceId}
          open={editDebtTransactionDialog.open}
          onOpenChange={editDebtTransactionDialog.closeDialog}
          onCloseComplete={editDebtTransactionDialog.unmountDialog}
        />
      ) : null}

      {deleteDebtDialog.mounted ? (
        <DeleteDebtDialog
          debt={deleteDebtDialog.data.debt}
          workspaceId={workspaceId}
          open={deleteDebtDialog.open}
          onOpenChange={deleteDebtDialog.closeDialog}
        />
      ) : null}

      {createTransactionDialog.mounted ? (
        <CreateTransactionDialog
          workspaceId={createTransactionDialog.data.workspaceId}
          account={createTransactionDialog.data.account}
          open={createTransactionDialog.open}
          onOpenChange={createTransactionDialog.closeDialog}
          onCloseComplete={createTransactionDialog.unmountDialog}
          defaultType={createTransactionDialog.data.defaultType}
          initialAmount={createTransactionDialog.data.initialAmount}
          initialDescription={createTransactionDialog.data.initialDescription}
          initialDate={createTransactionDialog.data.initialDate}
          initialCategoryId={createTransactionDialog.data.initialCategoryId}
        />
      ) : null}
    </>
  );
}
