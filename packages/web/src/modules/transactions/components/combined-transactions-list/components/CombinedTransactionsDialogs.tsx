import { lazy, Suspense, useEffect } from "react";

import { DebtTransactionActionsDialog } from "@/modules/debts/components/debt-transaction-actions-dialog";
import { hasDebtWriteOff } from "@/modules/debts/components/debt-write-off-dialog/debt-write-off-dialog.utils";
import { DebtTransactionType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import { TransactionActionsDialog } from "../../transaction-actions-dialog/TransactionActionsDialog";
import type { CombinedTransactionsController } from "../hooks/useCombinedTransactionsController";
import type { ActionableCombinedTransaction } from "../types";
import { canCreateScheduledPaymentFromTransaction } from "../utils/scheduledPaymentFromTransaction";

const loadDebtWriteOffDialog = () =>
  import("@/modules/debts/components/debt-write-off-dialog").then((module) => ({
    default: module.DebtWriteOffDialog,
  }));
const DebtWriteOffDialog = lazy(loadDebtWriteOffDialog);
const loadDeleteDebtDialog = () =>
  import("@/modules/debts/components/delete-debt-dialog").then((module) => ({ default: module.DeleteDebtDialog }));
const DeleteDebtDialog = lazy(loadDeleteDebtDialog);
const loadEditDebtDialog = () =>
  import("@/modules/debts/components/edit-debt-dialog").then((module) => ({ default: module.EditDebtDialog }));
const EditDebtDialog = lazy(loadEditDebtDialog);
const loadEditDebtTransactionDialog = () =>
  import("@/modules/debts/components/edit-debt-transaction-dialog").then((module) => ({
    default: module.EditDebtTransactionDialog,
  }));
const EditDebtTransactionDialog = lazy(loadEditDebtTransactionDialog);
const loadCreateScheduledPaymentDialog = () =>
  import("@/modules/scheduled-payments/components/CreateScheduledPaymentDialog").then((module) => ({
    default: module.CreateScheduledPaymentDialog,
  }));
const CreateScheduledPaymentDialog = lazy(loadCreateScheduledPaymentDialog);
const loadCreateTransactionDialog = () =>
  import("../../create-transaction-dialog/CreateTransactionDialog").then((module) => ({
    default: module.CreateTransactionDialog,
  }));
const CreateTransactionDialog = lazy(loadCreateTransactionDialog);
const loadEditTransactionDialog = () =>
  import("../../edit-transaction-dialog/EditTransactionDialog").then((module) => ({
    default: module.EditTransactionDialog,
  }));
const EditTransactionDialog = lazy(loadEditTransactionDialog);
const loadEditTransferDialog = () =>
  import("../../edit-transfer-dialog/EditTransferDialog").then((module) => ({ default: module.EditTransferDialog }));
const EditTransferDialog = lazy(loadEditTransferDialog);

function preloadTransactionDetailDialogs(transaction: ActionableCombinedTransaction) {
  if (transaction.kind === "transferTransaction") {
    void loadEditTransferDialog().catch(() => undefined);
    return;
  }

  if (hasDebtWriteOff(transaction.data)) {
    void loadDebtWriteOffDialog().catch(() => undefined);
    return;
  }

  const preloadRequests = [loadCreateTransactionDialog(), loadEditTransactionDialog()];
  if (canCreateScheduledPaymentFromTransaction(transaction)) {
    preloadRequests.push(loadCreateScheduledPaymentDialog());
  }

  void Promise.all(preloadRequests).catch(() => undefined);
}

function preloadDebtTransactionDetailDialogs(debtTransaction: DebtTransactionWithRelations) {
  const preloadRequests =
    debtTransaction.type === DebtTransactionType.CREATED
      ? [loadDeleteDebtDialog(), loadEditDebtDialog()]
      : [loadEditDebtTransactionDialog()];

  void Promise.all(preloadRequests).catch(() => undefined);
}

interface CombinedTransactionsDialogsProps {
  controller: CombinedTransactionsController;
}

export function CombinedTransactionsDialogs({ controller }: CombinedTransactionsDialogsProps) {
  const {
    workspaceId,
    dialogs: {
      editTransactionDialog,
      editDebtWriteOffDialog,
      editTransferDialog,
      editDebtDialog,
      editDebtTransactionDialog,
      deleteDebtDialog,
      actionsDialog,
      debtActionsDialog,
      createTransactionDialog,
      createScheduledPaymentDialog,
    },
    handleTransactionDelete,
    handleTransactionEdit,
    handleTransactionRepeat,
    handleCreateScheduledPayment,
    handleDebtTransactionDelete,
    handleDebtTransactionEdit,
  } = controller;
  const actionTransaction = actionsDialog.mounted ? actionsDialog.data.transaction : null;
  const debtActionTransaction = debtActionsDialog.mounted ? debtActionsDialog.data.debtTransaction : null;

  useEffect(() => {
    if (actionTransaction) {
      preloadTransactionDetailDialogs(actionTransaction);
    }
    if (debtActionTransaction) {
      preloadDebtTransactionDetailDialogs(debtActionTransaction);
    }
  }, [actionTransaction, debtActionTransaction]);

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
          onRepeat={
            actionsDialog.data.transaction.kind === "paymentTransaction" &&
            actionsDialog.data.transaction.data.debtWriteOff
              ? undefined
              : () => {
                  handleTransactionRepeat(actionsDialog.data.transaction);
                }
          }
          onCreatePayment={
            canCreateScheduledPaymentFromTransaction(actionsDialog.data.transaction)
              ? () => {
                  handleCreateScheduledPayment(actionsDialog.data.transaction);
                }
              : undefined
          }
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

      <Suspense fallback={null}>
        {editTransactionDialog.mounted ? (
          <EditTransactionDialog
            transaction={editTransactionDialog.data.transaction}
            workspaceId={editTransactionDialog.data.workspaceId}
            open={editTransactionDialog.open}
            onOpenChange={editTransactionDialog.closeDialog}
            onCloseComplete={editTransactionDialog.unmountDialog}
          />
        ) : null}

        {editDebtWriteOffDialog.mounted ? (
          <DebtWriteOffDialog
            transaction={editDebtWriteOffDialog.data.transaction}
            workspaceId={editDebtWriteOffDialog.data.workspaceId}
            open={editDebtWriteOffDialog.open}
            onOpenChange={editDebtWriteOffDialog.closeDialog}
            onCloseComplete={editDebtWriteOffDialog.unmountDialog}
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

        {createScheduledPaymentDialog.mounted ? (
          <CreateScheduledPaymentDialog
            workspaceId={workspaceId}
            initialValues={createScheduledPaymentDialog.data}
            open={createScheduledPaymentDialog.open}
            onOpenChange={createScheduledPaymentDialog.closeDialog}
            onCloseComplete={createScheduledPaymentDialog.unmountDialog}
          />
        ) : null}
      </Suspense>
    </>
  );
}
