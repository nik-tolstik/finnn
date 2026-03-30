import type { DebtTransactionWithRelations, DebtWithRelations } from "@/modules/debts/debt.types";

import type { PaymentTransactionType } from "../../transaction.constants";
import type {
  CombinedTransaction,
  PaymentTransactionWithRelations,
  TransactionAccountWithOwner,
  TransferTransactionWithRelations,
} from "../../transaction.types";

export interface CombinedTransactionsListProps {
  transactions: CombinedTransaction[];
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  workspaceId: string;
  isLoadingMore?: boolean;
}

export type ActionableCombinedTransaction = Extract<
  CombinedTransaction,
  { kind: "paymentTransaction" } | { kind: "transferTransaction" }
>;

export type PreparedCombinedTransaction = CombinedTransaction;

export interface PreparedCombinedTransactionGroup {
  date: Date;
  items: PreparedCombinedTransaction[];
}

export interface EditTransactionDialogData {
  transaction: PaymentTransactionWithRelations;
  workspaceId: string;
}

export interface EditTransferDialogData {
  transferTransaction: TransferTransactionWithRelations;
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
  transaction: ActionableCombinedTransaction;
}

export interface DebtTransactionActionsDialogData {
  debtTransaction: DebtTransactionWithRelations;
}

export interface CreateTransactionDialogData {
  workspaceId: string;
  account: TransactionAccountWithOwner;
  defaultType: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
  initialAmount: string;
  initialDescription: string | undefined;
  initialDate: Date;
  initialCategoryId: string | undefined;
}
