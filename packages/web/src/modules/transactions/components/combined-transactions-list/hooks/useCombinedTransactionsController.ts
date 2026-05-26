import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DebtTransactionType } from "@/modules/debts/debt.constants";
import { deleteDebtTransaction } from "@/modules/debts/debt.service";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
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
import { compareMoney, subtractMoney } from "@/shared/utils/money";

import { deletePaymentTransaction, deleteTransferTransaction } from "../../../transaction.api";
import type { PaymentTransactionType } from "../../../transaction.constants";
import type {
  ActionableCombinedTransaction,
  CreateTransactionDialogData,
  DebtTransactionActionsDialogData,
  DeleteDebtDialogData,
  EditDebtDialogData,
  EditDebtTransactionDialogData,
  EditTransactionDialogData,
  EditTransferDialogData,
  TransactionActionsDialogData,
} from "../types";
import { getDebtFromTransaction } from "../utils/getDebtFromTransaction";

const DIALOG_TRANSITION_DELAY_MS = 200;

interface UseCombinedTransactionsControllerParams {
  workspaceId: string;
}

export function useCombinedTransactionsController({ workspaceId }: UseCombinedTransactionsControllerParams) {
  const queryClient = useQueryClient();

  const editTransactionDialog = useDialogState<EditTransactionDialogData>();
  const editTransferDialog = useDialogState<EditTransferDialogData>();
  const editDebtDialog = useDialogState<EditDebtDialogData>();
  const editDebtTransactionDialog = useDialogState<EditDebtTransactionDialogData>();
  const deleteDebtDialog = useDialogState<DeleteDebtDialogData>();
  const actionsDialog = useDialogState<TransactionActionsDialogData>();
  const debtActionsDialog = useDialogState<DebtTransactionActionsDialogData>();
  const createTransactionDialog = useDialogState<CreateTransactionDialogData>();

  const openTransactionActions = (transaction: ActionableCombinedTransaction) => {
    actionsDialog.openDialog({ transaction });
  };

  const openDebtTransactionActions = (debtTransaction: DebtTransactionWithRelations) => {
    debtActionsDialog.openDialog({ debtTransaction });
  };

  const handleTransactionRepeat = (transaction: ActionableCombinedTransaction) => {
    if (transaction.kind !== "paymentTransaction") {
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

  const handleTransactionDelete = async (transaction: ActionableCombinedTransaction) => {
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
      editTransferDialog,
      editDebtDialog,
      editDebtTransactionDialog,
      deleteDebtDialog,
      actionsDialog,
      debtActionsDialog,
      createTransactionDialog,
    },
    openTransactionActions,
    openDebtTransactionActions,
    handleTransactionRepeat,
    handleTransactionDelete,
    handleTransactionEdit,
    handleDebtTransactionDelete,
    handleDebtTransactionEdit,
  };
}

export type CombinedTransactionsController = ReturnType<typeof useCombinedTransactionsController>;
