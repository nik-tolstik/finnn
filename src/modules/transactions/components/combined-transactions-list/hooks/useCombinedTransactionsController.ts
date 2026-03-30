import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DebtTransactionType } from "@/modules/debts/debt.constants";
import { deleteDebtTransaction } from "@/modules/debts/debt.service";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";

import type { PaymentTransactionType } from "../../../transaction.constants";
import { deletePaymentTransaction, deleteTransferTransaction } from "../../../transaction.service";
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
    try {
      const result =
        transaction.kind === "transferTransaction"
          ? await deleteTransferTransaction(transaction.data.id)
          : await deletePaymentTransaction(transaction.data.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      await invalidateWorkspaceDomains(queryClient, workspaceId, ["transactions", "accounts"]);
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
      const result = await deleteDebtTransaction(debtTransaction.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Транзакция долга удалена");
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["debts", "transactions", "accounts"]);
      debtActionsDialog.closeDialog();
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
