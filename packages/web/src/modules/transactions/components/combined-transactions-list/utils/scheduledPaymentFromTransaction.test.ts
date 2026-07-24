import { describe, expect, it } from "vitest";

import { PaymentTransactionType } from "../../../transaction.constants";
import type { PaymentTransactionWithRelations, TransferTransactionWithRelations } from "../../../transaction.types";
import type { ActionableCombinedTransaction } from "../types";
import {
  canCreateScheduledPaymentFromTransaction,
  getScheduledPaymentInitialValues,
} from "./scheduledPaymentFromTransaction";

function createPaymentTransaction(
  overrides: Partial<PaymentTransactionWithRelations> = {}
): PaymentTransactionWithRelations {
  return {
    id: "transaction-1",
    workspaceId: "workspace-1",
    accountId: "account-1",
    amount: "42.50",
    type: PaymentTransactionType.EXPENSE,
    description: "  Интернет  ",
    date: new Date("2026-07-10T12:30:00.000Z"),
    categoryId: "category-1",
    createdByAi: false,
    createdAt: new Date("2026-07-10T12:30:00.000Z"),
    updatedAt: new Date("2026-07-10T12:30:00.000Z"),
    account: {
      id: "account-1",
      name: "Основной",
      currency: "BYN",
      color: null,
      icon: null,
      ownerId: "user-1",
      owner: null,
    },
    category: {
      id: "category-1",
      name: "Связь",
    },
    debtWriteOff: null,
    ...overrides,
  };
}

function createTransferTransaction(): TransferTransactionWithRelations {
  return {
    id: "transfer-1",
    workspaceId: "workspace-1",
    fromAccountId: "account-1",
    toAccountId: "account-2",
    createdById: "user-1",
    amount: "10",
    toAmount: "10",
    description: null,
    date: new Date("2026-07-10T12:30:00.000Z"),
    createdByAi: false,
    createdAt: new Date("2026-07-10T12:30:00.000Z"),
    updatedAt: new Date("2026-07-10T12:30:00.000Z"),
    fromAccount: {
      id: "account-1",
      name: "Основной",
      currency: "BYN",
      color: null,
      icon: null,
      ownerId: "user-1",
      owner: null,
    },
    toAccount: {
      id: "account-2",
      name: "Накопления",
      currency: "BYN",
      color: null,
      icon: null,
      ownerId: "user-1",
      owner: null,
    },
    createdBy: null,
  };
}

describe("scheduled payment from transaction", () => {
  it("allows creating a scheduled payment only from an expense", () => {
    const expense: ActionableCombinedTransaction = {
      kind: "paymentTransaction",
      data: createPaymentTransaction(),
    };
    const income: ActionableCombinedTransaction = {
      kind: "paymentTransaction",
      data: createPaymentTransaction({ type: PaymentTransactionType.INCOME }),
    };
    const transfer: ActionableCombinedTransaction = {
      kind: "transferTransaction",
      data: createTransferTransaction(),
    };

    expect(canCreateScheduledPaymentFromTransaction(expense)).toBe(true);
    expect(canCreateScheduledPaymentFromTransaction(income)).toBe(false);
    expect(canCreateScheduledPaymentFromTransaction(transfer)).toBe(false);
  });

  it("does not create a scheduled payment from a debt write-off expense", () => {
    const writeOff: ActionableCombinedTransaction = {
      kind: "paymentTransaction",
      data: createPaymentTransaction({
        debtWriteOff: {
          debtTransactionId: "debt-transaction-1",
          debtId: "debt-1",
          debtType: "lent",
          personName: "Alex",
          debtCurrency: "BYN",
          amount: "42.50",
          remainingAmount: "0",
          status: "closed",
        },
      }),
    };

    expect(canCreateScheduledPaymentFromTransaction(writeOff)).toBe(false);
  });

  it("copies the expense values into scheduled payment defaults", () => {
    const transaction = createPaymentTransaction();

    const initialValues = getScheduledPaymentInitialValues(transaction);

    expect(initialValues).toEqual({
      name: "Интернет",
      amount: "42.50",
      currency: "BYN",
      accountId: "account-1",
      categoryId: "category-1",
      nextDueAt: new Date("2026-07-10T12:30:00.000Z"),
      scheduleKind: "one_time",
    });
    expect(initialValues.nextDueAt).not.toBe(transaction.date);
  });

  it.each([null, "", "   "])("uses a fallback name when description is %j", (description) => {
    const initialValues = getScheduledPaymentInitialValues(createPaymentTransaction({ description }));

    expect(initialValues.name).toBe("Новый платёж");
  });

  it("keeps an empty category unselected", () => {
    const initialValues = getScheduledPaymentInitialValues(
      createPaymentTransaction({
        categoryId: null,
        category: null,
      })
    );

    expect(initialValues.categoryId).toBeNull();
  });
});
