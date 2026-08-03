import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { hasDebtWriteOff } from "@/modules/debts/components/debt-write-off-dialog/debt-write-off-dialog.utils";
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
  DeleteDebtDialogData,
  EditDebtDialogData,
  EditDebtTransactionDialogData,
  EditDebtWriteOffDialogData,
  EditTransactionDialogData,
  EditTransferDialogData,
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
  const createTransactionDialog = useDialogState<CreateTransactionDialogData>();
  const createScheduledPaymentDialog = useDialogState<ScheduledPaymentFormInitialValues>();

  const closeTransactionDialog = (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind === "transferTransaction") {
      editTransferDialog.closeDialog();
      return;
    }

    if (hasDebtWriteOff(transaction.data)) {
      editDebtWriteOffDialog.closeDialog();
      return;
    }

    editTransactionDialog.closeDialog();
  };

  const openTransactionDialog = (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind === "transferTransaction") {
      editTransferDialog.openDialog({ transferTransaction: transaction.data, workspaceId });
      return;
    }

    if (hasDebtWriteOff(transaction.data)) {
      editDebtWriteOffDialog.openDialog({ transaction: transaction.data, workspaceId });
      return;
    }

    editTransactionDialog.openDialog({ transaction: transaction.data, workspaceId });
  };

  const closeDebtTransactionDialog = (debtTransaction: DebtTransactionWithRelations) => {
    if (debtTransaction.type === DebtTransactionType.CREATED) {
      editDebtDialog.closeDialog();
      return;
    }

    editDebtTransactionDialog.closeDialog();
  };

  const openDebtTransactionDialog = (debtTransaction: DebtTransactionWithRelations) => {
    if (debtTransaction.type === DebtTransactionType.CREATED) {
      editDebtDialog.openDialog({
        debt: getDebtFromTransaction(debtTransaction),
        debtTransaction,
        workspaceId,
      });
      return;
    }

    editDebtTransactionDialog.openDialog({ debtTransaction, workspaceId });
  };

  const handleTransactionRepeat = (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind !== "paymentTransaction" || hasDebtWriteOff(transaction.data)) {
      return;
    }

    const initialValues: CreateTransactionDialogData = {
      workspaceId,
      account: transaction.data.account,
      defaultType: transaction.data.type as PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE,
      initialAmount: transaction.data.amount,
      initialDescription: transaction.data.description || undefined,
      initialDate: new Date(),
      initialCategoryId: transaction.data.category?.id || undefined,
    };
    closeTransactionDialog(transaction);
    setTimeout(() => {
      createTransactionDialog.openDialog(initialValues);
    }, DIALOG_TRANSITION_DELAY_MS);
  };

  const handleCreateScheduledPayment = (transaction: ActionableCombinedTransaction) => {
    if (!canCreateScheduledPaymentFromTransaction(transaction)) {
      return;
    }

    const initialValues = getScheduledPaymentInitialValues(transaction.data);
    closeTransactionDialog(transaction);
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
          onApplied: () => closeTransactionDialog(transaction),
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
        onApplied: () => closeTransactionDialog(transaction),
        mutation: () =>
          transaction.kind === "transferTransaction"
            ? deleteTransferTransaction(transaction.data.id)
            : deletePaymentTransaction(transaction.data.id),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }
    } catch {
      toast.error("Не удалось удалить транзакцию");
    }
  };

  const handleDebtTransactionDelete = async (debtTransaction: DebtTransactionWithRelations) => {
    if (debtTransaction.type === DebtTransactionType.CREATED) {
      closeDebtTransactionDialog(debtTransaction);
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
        onApplied: () => closeDebtTransactionDialog(debtTransaction),
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

  return {
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
    openTransactionDialog,
    openDebtTransactionDialog,
    handleTransactionRepeat,
    handleCreateScheduledPayment,
    handleTransactionDelete,
    handleDebtTransactionDelete,
  };
}

export type CombinedTransactionsController = ReturnType<typeof useCombinedTransactionsController>;
