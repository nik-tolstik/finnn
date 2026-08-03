import { lazy, Suspense } from "react";

import { DebtWriteOffDialog } from "@/modules/debts/components/debt-write-off-dialog";
import { EditDebtDialog } from "@/modules/debts/components/edit-debt-dialog";
import { EditDebtTransactionDialog } from "@/modules/debts/components/edit-debt-transaction-dialog";

import { EditTransactionDialog } from "../../edit-transaction-dialog";
import { EditTransferDialog } from "../../edit-transfer-dialog";
import type { CombinedTransactionsController } from "../hooks/useCombinedTransactionsController";
import { canCreateScheduledPaymentFromTransaction } from "../utils/scheduledPaymentFromTransaction";

const loadDeleteDebtDialog = () =>
  import("@/modules/debts/components/delete-debt-dialog").then((module) => ({ default: module.DeleteDebtDialog }));
const DeleteDebtDialog = lazy(loadDeleteDebtDialog);
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
      createTransactionDialog,
      createScheduledPaymentDialog,
    },
    handleTransactionDelete,
    handleTransactionRepeat,
    handleCreateScheduledPayment,
    handleDebtTransactionDelete,
  } = controller;

  return (
    <>
      <Suspense fallback={null}>
        {editDebtWriteOffDialog.mounted ? (
          <DebtWriteOffDialog
            transaction={editDebtWriteOffDialog.data.transaction}
            workspaceId={editDebtWriteOffDialog.data.workspaceId}
            open={editDebtWriteOffDialog.open}
            onOpenChange={editDebtWriteOffDialog.closeDialog}
            onCloseComplete={editDebtWriteOffDialog.unmountDialog}
            onDelete={() => {
              handleTransactionDelete({
                kind: "paymentTransaction",
                data: editDebtWriteOffDialog.data.transaction,
              });
            }}
          />
        ) : null}

        {editDebtDialog.mounted ? (
          <EditDebtDialog
            debt={editDebtDialog.data.debt}
            workspaceId={editDebtDialog.data.workspaceId}
            open={editDebtDialog.open}
            onOpenChange={editDebtDialog.closeDialog}
            onCloseComplete={editDebtDialog.unmountDialog}
            onDelete={() => handleDebtTransactionDelete(editDebtDialog.data.debtTransaction)}
          />
        ) : null}

        {editDebtTransactionDialog.mounted ? (
          <EditDebtTransactionDialog
            debtTransaction={editDebtTransactionDialog.data.debtTransaction}
            workspaceId={editDebtTransactionDialog.data.workspaceId}
            open={editDebtTransactionDialog.open}
            onOpenChange={editDebtTransactionDialog.closeDialog}
            onCloseComplete={editDebtTransactionDialog.unmountDialog}
            onDelete={() => handleDebtTransactionDelete(editDebtTransactionDialog.data.debtTransaction)}
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

      {editTransactionDialog.mounted ? (
        <EditTransactionDialog
          transaction={editTransactionDialog.data.transaction}
          workspaceId={editTransactionDialog.data.workspaceId}
          open={editTransactionDialog.open}
          onOpenChange={editTransactionDialog.closeDialog}
          onCloseComplete={editTransactionDialog.unmountDialog}
          onDelete={() => {
            handleTransactionDelete({
              kind: "paymentTransaction",
              data: editTransactionDialog.data.transaction,
            });
          }}
          onRepeat={() => {
            handleTransactionRepeat({
              kind: "paymentTransaction",
              data: editTransactionDialog.data.transaction,
            });
          }}
          onCreateScheduledPayment={
            canCreateScheduledPaymentFromTransaction({
              kind: "paymentTransaction",
              data: editTransactionDialog.data.transaction,
            })
              ? () => {
                  handleCreateScheduledPayment({
                    kind: "paymentTransaction",
                    data: editTransactionDialog.data.transaction,
                  });
                }
              : undefined
          }
        />
      ) : null}

      {editTransferDialog.mounted ? (
        <EditTransferDialog
          transferTransaction={editTransferDialog.data.transferTransaction}
          workspaceId={editTransferDialog.data.workspaceId}
          open={editTransferDialog.open}
          onOpenChange={editTransferDialog.closeDialog}
          onCloseComplete={editTransferDialog.unmountDialog}
          onDelete={() => {
            handleTransactionDelete({
              kind: "transferTransaction",
              data: editTransferDialog.data.transferTransaction,
            });
          }}
        />
      ) : null}
    </>
  );
}
