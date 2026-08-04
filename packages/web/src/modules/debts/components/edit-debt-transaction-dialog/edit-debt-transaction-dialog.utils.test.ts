import { describe, expect, it } from "vitest";

import { DebtTransactionType, DebtType } from "../../debt.constants";
import type { DebtTransactionWithRelations } from "../../debt.types";
import { getPreviewDebtTransactionAccount } from "./edit-debt-transaction-dialog.utils";

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
