import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import type { CombinedTransaction, PaymentTransactionWithRelations } from "../transaction.types";

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
    return getTransferDescriptionSegments();
  }

  return getIncomeExpenseDescriptionSegments(item.data);
}

function getIncomeExpenseDescriptionSegments(transaction: PaymentTransactionWithRelations): {
  segments: DescriptionSegment[];
} {
  const category = transaction.category?.name ?? "Без категории";

  return {
    segments: [{ text: category, highlight: true, segmentType: "category" }],
  };
}

function getTransferDescriptionSegments(): {
  segments: DescriptionSegment[];
} {
  return {
    segments: [{ text: "Перевод", highlight: true }],
  };
}

function getDebtActorName(account: DebtTransactionWithRelations["account"], workspaceName: string): string {
  if (!account) return "Кто-то";
  if (account.ownerId === null) return workspaceName || "Общие";
  return account.owner?.name ?? account.owner?.email ?? "Кто-то";
}

function getDebtDescriptionSegments(
  debtTransaction: DebtTransactionWithRelations,
  workspaceName: string
): { segments: DescriptionSegment[] } {
  const personName = debtTransaction.debt.personName;
  const actor = getDebtActorName(debtTransaction.account, workspaceName);

  const debtType = debtTransaction.debt.type;
  const transactionType = debtTransaction.type;

  if (debtType === DebtType.LENT && transactionType === DebtTransactionType.CLOSED) {
    return {
      segments: [
        { text: personName, highlight: true },
        { text: " вернул долг", highlight: false },
      ],
    };
  }

  if (debtType === DebtType.BORROWED && transactionType === DebtTransactionType.CLOSED) {
    return {
      segments: [
        { text: actor, highlight: true },
        { text: " вернул долг", highlight: false },
      ],
    };
  }

  if (debtType === DebtType.LENT && transactionType === DebtTransactionType.CREATED) {
    return {
      segments: [
        { text: personName, highlight: true },
        { text: " взял в долг", highlight: false },
      ],
    };
  }

  if (debtType === DebtType.BORROWED && transactionType === DebtTransactionType.CREATED) {
    return {
      segments: [
        { text: personName, highlight: true },
        { text: " дал в долг", highlight: false },
      ],
    };
  }

  if (debtType === DebtType.LENT && transactionType === DebtTransactionType.ADDED) {
    return {
      segments: [
        { text: personName, highlight: true },
        { text: " взял в долг", highlight: false },
      ],
    };
  }

  return {
    segments: [
      { text: personName, highlight: true },
      { text: " добавил к долгу", highlight: false },
    ],
  };
}
