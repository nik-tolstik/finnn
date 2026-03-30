import type { DebtTransactionWithRelations, DebtWithRelations } from "@/modules/debts/debt.types";

import type { TransactionType } from "../../transaction.constants";
import type { CombinedTransaction, TransactionWithRelations } from "../../transaction.types";

export interface CombinedTransactionsListProps {
  transactions: CombinedTransaction[];
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  workspaceId: string;
  isLoadingMore?: boolean;
}

export type TransferDisplayInfo = {
  account: TransactionWithRelations["account"];
  amount: string;
};

export type PreparedCombinedTransaction =
  | { kind: "debtTransaction"; data: DebtTransactionWithRelations }
  | { kind: "transaction"; data: TransactionWithRelations }
  | { kind: "transfer"; data: TransactionWithRelations; transferInfo: TransferDisplayInfo };

export interface PreparedCombinedTransactionGroup {
  date: Date;
  items: PreparedCombinedTransaction[];
}

export interface EditTransactionDialogData {
  transaction: TransactionWithRelations;
  workspaceId: string;
}

export interface EditDebtDialogData {
  debt: DebtWithRelations;
  workspaceId: string;
}

export interface EditDebtTransactionDialogData {
  debtTransaction: DebtTransactionWithRelations;
  workspaceId: string;
}

export interface DeleteDebtDialogData {
  debt: DebtWithRelations;
}

export interface TransactionActionsDialogData {
  transaction: TransactionWithRelations;
}

export interface DebtTransactionActionsDialogData {
  debtTransaction: DebtTransactionWithRelations;
}

export interface CreateTransactionDialogData {
  workspaceId: string;
  account: TransactionWithRelations["account"];
  defaultType: TransactionType.INCOME | TransactionType.EXPENSE;
  initialAmount: string;
  initialDescription: string | undefined;
  initialDate: Date;
  initialCategoryId: string | undefined;
}
