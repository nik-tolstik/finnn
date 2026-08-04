import { describe, expect, it } from "vitest";

import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import { filterCombinedTransactions } from "./combined-transaction-filtering";

function createDebtTransaction(description: string | null): DebtTransactionWithRelations {
  return {
    id: "debt-transaction-1",
    workspaceId: "workspace-1",
    debtId: "debt-1",
    accountId: "account-1",
    paymentTransactionId: null,
    type: "closed",
    amount: "25",
    toAmount: null,
    description,
    date: new Date("2026-04-03T00:00:00.000Z"),
    createdAt: new Date("2026-04-03T00:00:00.000Z"),
    debt: {
      id: "debt-1",
      workspaceId: "workspace-1",
      type: "lent",
      personName: "Alex",
      amount: "100",
      remainingAmount: "75",
      currency: "USD",
      date: new Date("2026-04-01T00:00:00.000Z"),
      status: "open",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    },
    account: null,
  };
}

describe("combined transaction filtering", () => {
  it("matches debt transactions by description", () => {
    const transactions = [{ kind: "debtTransaction" as const, data: createDebtTransaction("Returned cash") }];

    expect(filterCombinedTransactions(transactions, { description: "cash" })).toEqual(transactions);
  });

  it("does not match debt transactions without a description", () => {
    const transactions = [{ kind: "debtTransaction" as const, data: createDebtTransaction(null) }];

    expect(filterCombinedTransactions(transactions, { description: "cash" })).toEqual([]);
  });
});
