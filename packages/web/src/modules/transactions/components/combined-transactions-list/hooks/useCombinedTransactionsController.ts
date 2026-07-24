import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { hasDebtWriteOff } from "@/modules/debts/components/debt-write-off-dialog";
import { deleteDebtTransaction, deleteDebtWriteOff } from "@/modules/debts/debt.api";
import { DebtTransactionType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import type { ScheduledPaymentFormInitialValues } from "@/modules/scheduled-payments/scheduled-payment.types";
import { useDialogState } from "@/shared/hooks/useDialogState";
import {
  addAccountBalanceDelta,
  getDebtDeletionBalanceDelta,
  getDebtTransactionTotalsDelta,
  getPaymentTransactionBalanceDelta,
  getTransferTransactionBalanceDeltas,
} from "@/shared/lib/balance-domain";
import {
  removeTransactionsFromCache,
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
  updateDebtsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { deletePaymentTransaction, deleteTransferTransaction } from "../../../transaction.api";
import type { PaymentTransactionType } from "../../../transaction.constants";
import type {
  ActionableCombinedTransaction,
  CreateTransactionDialogData,
  DebtTransactionActionsDialogData,
  DeleteDebtDialogData,
  EditDebtDialogData,
  EditDebtTransactionDialogData,
  EditDebtWriteOffDialogData,
  EditTransactionDialogData,
  EditTransferDialogData,
  TransactionActionsDialogData,
} from "../types";
import { getDebtFromTransaction } from "../utils/getDebtFromTransaction";
import {
  canCreateScheduledPaymentFromTransaction,
  getScheduledPaymentInitialValues,
} from "../utils/scheduledPaymentFromTransaction";

const DIALOG_TRANSITION_DELAY_MS = 200;

interface UseCombinedTransactionsControllerParams {
  workspaceId: string;
}

export function useCombinedTransactionsController({ workspaceId }: UseCombinedTransactionsControllerParams) {
  const queryClient = useQueryClient();

  const editTransactionDialog = useDialogState<EditTransactionDialogData>();
  const editDebtWriteOffDialog = useDialogState<EditDebtWriteOffDialogData>();
  const editTransferDialog = useDialogState<EditTransferDialogData>();
  const editDebtDialog = useDialogState<EditDebtDialogData>();
  const editDebtTransactionDialog = useDialogState<EditDebtTransactionDialogData>();
  const deleteDebtDialog = useDialogState<DeleteDebtDialogData>();
  const actionsDialog = useDialogState<TransactionActionsDialogData>();
  const debtActionsDialog = useDialogState<DebtTransactionActionsDialogData>();
  const createTransactionDialog = useDialogState<CreateTransactionDialogData>();
  const createScheduledPaymentDialog = useDialogState<ScheduledPaymentFormInitialValues>();

  const openTransactionActions = (transaction: ActionableCombinedTransaction) => {
    actionsDialog.openDialog({ transaction });
  };

  const openDebtTransactionActions = (debtTransaction: DebtTransactionWithRelations) => {
    debtActionsDialog.openDialog({ debtTransaction });
  };

  const handleTransactionRepeat = (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind !== "paymentTransaction" || hasDebtWriteOff(transaction.data)) {
      return;
    }

    createTransactionDialog.openDialog({
      workspaceId,
      account: transaction.data.account,
      defaultType: transaction.data.type as PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE,
      initialAmount: transaction.data.amount,
      initialDescription: transaction.data.description || undefined,
      initialDate: new Date(),
      initialCategoryId: transaction.data.category?.id || undefined,
    });
    actionsDialog.closeDialog();
  };

  const handleCreateScheduledPayment = (transaction: ActionableCombinedTransaction) => {
    if (!canCreateScheduledPaymentFromTransaction(transaction)) {
      return;
    }

    const initialValues = getScheduledPaymentInitialValues(transaction.data);
    actionsDialog.closeDialog();
    setTimeout(() => {
      createScheduledPaymentDialog.openDialog(initialValues);
    }, DIALOG_TRANSITION_DELAY_MS);
  };

  const handleTransactionDelete = async (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind === "paymentTransaction" && hasDebtWriteOff(transaction.data)) {
      const { debtWriteOff } = transaction.data;
      const nextRemainingAmount = addMoney(debtWriteOff.remainingAmount, debtWriteOff.amount);

      try {
        const result = await runOptimisticWorkspaceMutation({
          queryClient,
          workspaceId,
          domains: ["debts", "transactions"],
          apply: (context) => {
            updateDebtsInCache(context, [
              {
                id: debtWriteOff.debtId,
                remainingAmount: nextRemainingAmount,
                status: "open",
              },
            ]);
            removeTransactionsFromCache(context, [transaction.data.id]);
          },
          onApplied: () => actionsDialog.closeDialog(),
          mutation: () => deleteDebtWriteOff(debtWriteOff.debtTransactionId),
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        toast.success("Погашение долга удалено");
      } catch {
        toast.error("Не удалось удалить погашение долга");
      }

      return;
    }

    const balanceDeltas = new Map<string, string>();
    if (transaction.kind === "transferTransaction") {
      const transferDeltas = getTransferTransactionBalanceDeltas(transaction.data.amount, transaction.data.toAmount);
      addAccountBalanceDelta(
        balanceDeltas,
        transaction.data.fromAccountId,
        subtractMoney("0", transferDeltas.fromDelta)
      );
      addAccountBalanceDelta(balanceDeltas, transaction.data.toAccountId, subtractMoney("0", transferDeltas.toDelta));
    } else {
      addAccountBalanceDelta(
        balanceDeltas,
        transaction.data.accountId,
        subtractMoney("0", getPaymentTransactionBalanceDelta(transaction.data.type, transaction.data.amount))
      );
    }

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          removeTransactionsFromCache(context, [transaction.data.id]);
        },
        onApplied: () => actionsDialog.closeDialog(),
        mutation: () =>
          transaction.kind === "transferTransaction"
            ? deleteTransferTransaction(transaction.data.id)
            : deletePaymentTransaction(transaction.data.id),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      actionsDialog.closeDialog();
    } catch {
      toast.error("Не удалось удалить транзакцию");
    }
  };

  const handleTransactionEdit = (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind === "transferTransaction") {
      editTransferDialog.openDialog({
        transferTransaction: transaction.data,
        workspaceId,
      });
      actionsDialog.closeDialog();
      return;
    }

    if (hasDebtWriteOff(transaction.data)) {
      editDebtWriteOffDialog.openDialog({ transaction: transaction.data, workspaceId });
      actionsDialog.closeDialog();
      return;
    }

    editTransactionDialog.openDialog({
      transaction: transaction.data,
      workspaceId,
    });
    actionsDialog.closeDialog();
  };

  const handleDebtTransactionDelete = async (debtTransaction: DebtTransactionWithRelations) => {
    if (debtTransaction.type === DebtTransactionType.CREATED) {
      debtActionsDialog.closeDialog();
      setTimeout(() => {
        deleteDebtDialog.openDialog({
          debt: getDebtFromTransaction(debtTransaction),
        });
      }, DIALOG_TRANSITION_DELAY_MS);
      return;
    }

    try {
      const balanceDeltas = new Map<string, string>();
      addAccountBalanceDelta(
        balanceDeltas,
        debtTransaction.accountId,
        getDebtDeletionBalanceDelta(debtTransaction.debt.type, debtTransaction)
      );
      const totalsDelta = getDebtTransactionTotalsDelta(debtTransaction.type, debtTransaction.amount);
      const remainingAmount = subtractMoney(debtTransaction.debt.remainingAmount, totalsDelta.remainingDelta);
      const amount = subtractMoney(debtTransaction.debt.amount, totalsDelta.amountDelta);

      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["debts", "transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          updateDebtsInCache(context, [
            {
              id: debtTransaction.debt.id,
              amount,
              remainingAmount,
              status: compareMoney(remainingAmount, "0") <= 0 ? "closed" : "open",
            },
          ]);
          removeTransactionsFromCache(context, [debtTransaction.id]);
        },
        onApplied: () => debtActionsDialog.closeDialog(),
        mutation: () => deleteDebtTransaction(debtTransaction.id),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Транзакция долга удалена");
    } catch {
      toast.error("Не удалось удалить транзакцию долга");
    }
  };

  const handleDebtTransactionEdit = (debtTransaction: DebtTransactionWithRelations) => {
    debtActionsDialog.closeDialog();

    setTimeout(() => {
      if (debtTransaction.type === DebtTransactionType.CREATED) {
        editDebtDialog.openDialog({
          debt: getDebtFromTransaction(debtTransaction),
          workspaceId,
        });
        return;
      }

      editDebtTransactionDialog.openDialog({
        debtTransaction,
        workspaceId,
      });
    }, DIALOG_TRANSITION_DELAY_MS);
  };

  return {
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
    openTransactionActions,
    openDebtTransactionActions,
    handleTransactionRepeat,
    handleCreateScheduledPayment,
    handleTransactionDelete,
    handleTransactionEdit,
    handleDebtTransactionDelete,
    handleDebtTransactionEdit,
  };
}

export type CombinedTransactionsController = ReturnType<typeof useCombinedTransactionsController>;
