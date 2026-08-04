import { describe, expect, it } from "vitest";

import { DebtTransactionType, DebtType } from "../../debt.constants";
import type { DebtTransactionWithRelations } from "../../debt.types";
import {
  getEditDebtTransactionSummaryPreview,
  getPreviewDebtTransactionAccount,
} from "./edit-debt-transaction-dialog.utils";

const debtTransaction = {
  id: "debt-transaction-1",
  workspaceId: "workspace-1",
  debtId: "debt-1",
  accountId: "account-1",
  paymentTransactionId: null,
  type: DebtTransactionType.CLOSED,
  amount: "10",
  toAmount: null,
  description: null,
  date: new Date("2026-01-02T00:00:00.000Z"),
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  debt: {
    id: "debt-1",
    workspaceId: "workspace-1",
    type: DebtType.BORROWED,
    personName: "Grace",
    amount: "100",
    remainingAmount: "90",
    currency: "BYN",
    date: new Date("2026-01-01T00:00:00.000Z"),
    status: "open",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  },
  account: null,
} satisfies DebtTransactionWithRelations;

describe("edit debt transaction dialog utils", () => {
  it("previews replacing a closed debt transaction amount", () => {
    expect(
      getEditDebtTransactionSummaryPreview({
        debtTransaction,
        amount: "30",
      })
    ).toEqual({ remainingAmount: "70", totalAmount: "100" });

    expect(
      getEditDebtTransactionSummaryPreview({
        debtTransaction,
        amount: "5",
      })
    ).toEqual({ remainingAmount: "95", totalAmount: "100" });
  });

  it("previews replacing an added debt transaction amount", () => {
    const addedDebtTransaction = {
      ...debtTransaction,
      type: DebtTransactionType.ADDED,
      amount: "20",
      debt: {
        ...debtTransaction.debt,
        amount: "120",
        remainingAmount: "110",
      },
    } satisfies DebtTransactionWithRelations;

    expect(
      getEditDebtTransactionSummaryPreview({
        debtTransaction: addedDebtTransaction,
        amount: "30",
      })
    ).toEqual({ remainingAmount: "120", totalAmount: "130" });
  });

  it("keeps the current debt summary for invalid amounts", () => {
    for (const amount of ["", "invalid", "0", "-1", "101"]) {
      expect(
        getEditDebtTransactionSummaryPreview({
          debtTransaction,
          amount,
        })
      ).toEqual({ remainingAmount: "90", totalAmount: "100" });
    }
  });

  it("previews a negative balance after increasing a borrowed-debt repayment", () => {
    expect(
      getPreviewDebtTransactionAccount({
        debtTransaction,
        selectedAccount: { id: "account-1", balance: "0", currency: "BYN" },
        amount: "30",
        currenciesMatch: true,
      })
    ).toEqual({ id: "account-1", balance: "-20", currency: "BYN" });
  });
});
