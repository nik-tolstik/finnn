import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { formatMoney } from "@/shared/utils/money";

import { PaymentTransactionType } from "../transaction.constants";
import type {
  CombinedTransaction,
  PaymentTransactionWithRelations,
  TransferTransactionWithRelations,
} from "../transaction.types";

export type AccountSegmentType = "account" | "accountFrom" | "accountTo";

export type SegmentType = AccountSegmentType | "category";

export type DescriptionSegment = {
  text: string;
  highlight: boolean;
  segmentType?: SegmentType;
};

export function getTransactionDescriptionSegments(
  item: CombinedTransaction,
  workspaceName: string
): { segments: DescriptionSegment[] } {
  if (item.kind === "debtTransaction") {
    return getDebtDescriptionSegments(item.data, workspaceName);
  }

  if (item.kind === "transferTransaction") {
    return getTransferDescriptionSegments(item.data, workspaceName);
  }

  return getIncomeExpenseDescriptionSegments(item.data, workspaceName);
}

function getActorName(
  account: {
    ownerId: string | null;
    owner: { name: string | null; email: string; image: string | null } | null;
  },
  workspaceName: string
): string {
  if (account.ownerId === null) {
    return workspaceName || "Общие";
  }
  return account.owner?.name ?? account.owner?.email ?? "Кто-то";
}

function getIncomeExpenseDescriptionSegments(
  transaction: PaymentTransactionWithRelations,
  workspaceName: string
): { segments: DescriptionSegment[] } {
  const actor = getActorName(transaction.account, workspaceName);
  const amountStr = formatMoney(transaction.amount, transaction.account.currency);
  const category = transaction.category?.name ?? "Без категории";
  const accountName = transaction.account.name;

  if (transaction.type === PaymentTransactionType.EXPENSE) {
    return {
      segments: [
        { text: actor, highlight: true },
        { text: " потратил ", highlight: false },
        { text: amountStr, highlight: true },
        { text: " на ", highlight: false },
        { text: category, highlight: true, segmentType: "category" },
        { text: " со счёта ", highlight: false },
        { text: accountName, highlight: true, segmentType: "account" },
      ],
    };
  }

  return {
    segments: [
      { text: actor, highlight: true },
      { text: " получил ", highlight: false },
      { text: category, highlight: true, segmentType: "category" },
      { text: " в размере ", highlight: false },
      { text: amountStr, highlight: true },
      { text: " на счёт ", highlight: false },
      { text: accountName, highlight: true, segmentType: "account" },
    ],
  };
}

function getTransferDescriptionSegments(
  transaction: TransferTransactionWithRelations,
  workspaceName: string
): { segments: DescriptionSegment[] } {
  const actor = getActorName(transaction.fromAccount, workspaceName);
  const amountStr = formatMoney(transaction.amount, transaction.fromAccount.currency);

  return {
    segments: [
      { text: actor, highlight: true },
      { text: " перевёл ", highlight: false },
      { text: amountStr, highlight: true },
      { text: " со счёта ", highlight: false },
      { text: transaction.fromAccount.name, highlight: true, segmentType: "accountFrom" },
      { text: " на счёт ", highlight: false },
      { text: transaction.toAccount.name, highlight: true, segmentType: "accountTo" },
    ],
  };
}

function getDebtActorName(account: DebtTransactionWithRelations["account"], workspaceName: string): string {
  if (!account) return "Кто-то";
  if (account.ownerId === null) return workspaceName || "Общие";
  return account.owner?.name ?? account.owner?.email ?? "Кто-то";
}

function getDebtClosedAmountText(debtTransaction: DebtTransactionWithRelations): string {
  const debtAmountText = formatMoney(debtTransaction.amount, debtTransaction.debt.currency);

  if (
    !debtTransaction.account ||
    !debtTransaction.toAmount ||
    debtTransaction.account.currency === debtTransaction.debt.currency
  ) {
    return debtAmountText;
  }

  const accountAmountText = formatMoney(debtTransaction.toAmount, debtTransaction.account.currency);
  return `${debtAmountText} (${accountAmountText})`;
}

function getDebtDescriptionSegments(
  debtTransaction: DebtTransactionWithRelations,
  workspaceName: string
): { segments: DescriptionSegment[] } {
  const personName = debtTransaction.debt.personName;
  const amountStr = formatMoney(debtTransaction.amount, debtTransaction.debt.currency);
  const accountName = debtTransaction.account?.name ?? "Мой кошелёк";
  const actor = getDebtActorName(debtTransaction.account, workspaceName);

  const debtType = debtTransaction.debt.type;
  const transactionType = debtTransaction.type;

  if (debtType === DebtType.LENT && transactionType === DebtTransactionType.CLOSED) {
    const closedAmountStr = getDebtClosedAmountText(debtTransaction);
    return {
      segments: [
        { text: personName, highlight: true },
        { text: " вернул долг в размере ", highlight: false },
        { text: closedAmountStr, highlight: true },
        { text: " на счёт ", highlight: false },
        { text: accountName, highlight: true, segmentType: "account" },
      ],
    };
  }

  if (debtType === DebtType.BORROWED && transactionType === DebtTransactionType.CLOSED) {
    const closedAmountStr = getDebtClosedAmountText(debtTransaction);
    return {
      segments: [
        { text: actor, highlight: true },
        { text: " вернул долг в размере ", highlight: false },
        { text: closedAmountStr, highlight: true },
        { text: " на счёт ", highlight: false },
        { text: accountName, highlight: true, segmentType: "account" },
      ],
    };
  }

  if (debtType === DebtType.LENT && transactionType === DebtTransactionType.CREATED) {
    return {
      segments: [
        { text: actor, highlight: true },
        { text: " дал в долг ", highlight: false },
        { text: personName, highlight: true },
        { text: " в размере ", highlight: false },
        { text: amountStr, highlight: true },
        { text: " со счёта ", highlight: false },
        { text: accountName, highlight: true, segmentType: "account" },
      ],
    };
  }

  if (debtType === DebtType.BORROWED && transactionType === DebtTransactionType.CREATED) {
    return {
      segments: [
        { text: personName, highlight: true },
        { text: " дал в долг в размере ", highlight: false },
        { text: amountStr, highlight: true },
        { text: " на счёт ", highlight: false },
        { text: accountName, highlight: true, segmentType: "account" },
      ],
    };
  }

  if (debtType === DebtType.LENT && transactionType === DebtTransactionType.ADDED) {
    return {
      segments: [
        { text: actor, highlight: true },
        { text: " добавил к долгу ", highlight: false },
        { text: personName, highlight: true },
        { text: " ", highlight: false },
        { text: amountStr, highlight: true },
        { text: " со счёта ", highlight: false },
        { text: accountName, highlight: true, segmentType: "account" },
      ],
    };
  }

  return {
    segments: [
      { text: personName, highlight: true },
      { text: " добавил к долгу ", highlight: false },
      { text: amountStr, highlight: true },
      { text: " на счёт ", highlight: false },
      { text: accountName, highlight: true, segmentType: "account" },
    ],
  };
}
