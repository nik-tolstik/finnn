import { describe, expect, it } from "vitest";

import { CategoryType } from "@/modules/categories/category.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

import { DebtStatus, DebtType } from "../../debt.constants";
import type { DebtWriteOffPaymentTransaction } from "../../debt.types";
import {
  getDebtWriteOffCategoryOptions,
  getDebtWriteOffDebt,
  getDebtWriteOffDefaultValues,
  getDebtWriteOffMaximumAmount,
  getDebtWriteOffRemainingAmount,
  getDebtWriteOffStatus,
  getDebtWriteOffType,
  isDateBeforeAccountCreation,
  isDebtWriteOffAmountWithinLimit,
} from "./debt-write-off-dialog.utils";

const debt = {
  id: "debt-1",
  workspaceId: "workspace-1",
  type: DebtType.LENT,
  personName: "Alex",
  amount: "100",
  remainingAmount: "75",
  currency: "USD",
  status: DebtStatus.OPEN,
};

const transaction: DebtWriteOffPaymentTransaction = {
  id: "payment-1",
  workspaceId: "workspace-1",
  accountId: "account-1",
  amount: "160",
  type: PaymentTransactionType.EXPENSE,
  description: "Custom note",
  date: new Date("2026-07-20T12:30:00.000Z"),
  categoryId: "category-1",
  createdByAi: false,
  createdAt: new Date("2026-07-20T12:30:00.000Z"),
  updatedAt: new Date("2026-07-20T12:30:00.000Z"),
  account: {
    id: "account-1",
    name: "Wallet",
    currency: "BYN",
    color: null,
    icon: null,
    ownerId: null,
    owner: null,
  },
  category: { id: "category-1", name: "Gifts" },
  debtWriteOff: {
    debtTransactionId: "debt-transaction-1",
    debtId: "debt-1",
    debtType: DebtType.LENT,
    personName: "Alex",
    debtCurrency: "USD",
    amount: "50",
    remainingAmount: "75",
    status: DebtStatus.OPEN,
  },
};

describe("debt write-off dialog utils", () => {
  it("maps debt direction to payment and category types", () => {
    expect(getDebtWriteOffType(DebtType.LENT)).toBe(PaymentTransactionType.EXPENSE);
    expect(getDebtWriteOffType(DebtType.BORROWED)).toBe(PaymentTransactionType.INCOME);
    expect(
      getDebtWriteOffCategoryOptions(
        [
          { id: "income", name: "Income", type: CategoryType.INCOME },
          { id: "expense", name: "Expense", type: CategoryType.EXPENSE },
        ],
        DebtType.LENT
      )
    ).toEqual([{ value: "expense", label: "Expense" }]);
  });

  it("builds create defaults from the current debt remainder", () => {
    const now = new Date("2026-07-23T08:00:00.000Z");
    expect(getDebtWriteOffDefaultValues({ debt, now })).toEqual({
      amount: "75",
      toAmount: "",
      accountId: "",
      categoryId: "",
      date: now,
      description: "Погашение долга: Alex",
    });
  });

  it("builds cross-currency edit defaults and restores the editable maximum", () => {
    expect(getDebtWriteOffDefaultValues({ debt, transaction })).toEqual({
      amount: "50",
      toAmount: "160",
      accountId: "account-1",
      categoryId: "category-1",
      date: new Date("2026-07-20T12:30:00.000Z"),
      description: "Custom note",
    });
    expect(getDebtWriteOffMaximumAmount(debt, transaction)).toBe("125");
    expect(getDebtWriteOffRemainingAmount({ debt, transaction, amount: "100" })).toBe("25");
  });

  it("reconstructs the debt amount for a transaction-based dialog", () => {
    expect(getDebtWriteOffDebt({ transaction })).toMatchObject({
      amount: "125",
      remainingAmount: "75",
    });
  });

  it("validates the cap, derives status, and compares calendar dates", () => {
    expect(isDebtWriteOffAmountWithinLimit("125", "125")).toBe(true);
    expect(isDebtWriteOffAmountWithinLimit("125.01", "125")).toBe(false);
    expect(getDebtWriteOffStatus("0")).toBe(DebtStatus.CLOSED);
    expect(getDebtWriteOffStatus("0.01")).toBe(DebtStatus.OPEN);
    expect(isDateBeforeAccountCreation(new Date(2026, 6, 19, 23, 59), new Date(2026, 6, 20, 0, 1))).toBe(true);
  });
});
