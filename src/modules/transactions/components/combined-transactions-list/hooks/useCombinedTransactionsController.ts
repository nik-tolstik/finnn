import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DebtTransactionType } from "@/modules/debts/debt.constants";
import { deleteDebtTransaction } from "@/modules/debts/debt.service";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";

import { TransactionType } from "../../../transaction.constants";
import { deleteTransaction } from "../../../transaction.service";
import type { TransactionWithRelations } from "../../../transaction.types";
import type {
  CreateTransactionDialogData,
  DebtTransactionActionsDialogData,
  DeleteDebtDialogData,
  EditDebtDialogData,
  EditDebtTransactionDialogData,
  EditTransactionDialogData,
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
  const editTransferDialog = useDialogState<EditTransactionDialogData>();
  const editDebtDialog = useDialogState<EditDebtDialogData>();
  const editDebtTransactionDialog = useDialogState<EditDebtTransactionDialogData>();
  const deleteDebtDialog = useDialogState<DeleteDebtDialogData>();
  const actionsDialog = useDialogState<TransactionActionsDialogData>();
  const debtActionsDialog = useDialogState<DebtTransactionActionsDialogData>();
  const createTransactionDialog = useDialogState<CreateTransactionDialogData>();

  const openTransactionActions = (transaction: TransactionWithRelations) => {
    actionsDialog.openDialog({ transaction });
  };

  const openDebtTransactionActions = (debtTransaction: DebtTransactionWithRelations) => {
    debtActionsDialog.openDialog({ debtTransaction });
  };

  const handleTransactionRepeat = (transaction: TransactionWithRelations) => {
    if (transaction.type === TransactionType.TRANSFER) {
      return;
    }

    createTransactionDialog.openDialog({
      workspaceId,
      account: transaction.account,
      defaultType: transaction.type as TransactionType.INCOME | TransactionType.EXPENSE,
      initialAmount: transaction.amount,
      initialDescription: transaction.description || undefined,
      initialDate: new Date(),
      initialCategoryId: transaction.category?.id || undefined,
    });
    actionsDialog.closeDialog();
  };

  const handleTransactionDelete = async (transaction: TransactionWithRelations) => {
    try {
      const result = await deleteTransaction(transaction.id);

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

  const handleTransactionEdit = (transaction: TransactionWithRelations) => {
    if (transaction.type === TransactionType.TRANSFER) {
      editTransferDialog.openDialog({
        transaction,
        workspaceId,
      });
      actionsDialog.closeDialog();
      return;
    }

    editTransactionDialog.openDialog({
      transaction,
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
