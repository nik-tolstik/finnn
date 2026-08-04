import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import { DebtTransactionItem } from "./DebtTransactionItem";

const debtTransaction: DebtTransactionWithRelations = {
  id: "debt-transaction-1",
  workspaceId: "workspace-1",
  debtId: "debt-1",
  accountId: null,
  paymentTransactionId: null,
  type: DebtTransactionType.CLOSED,
  amount: "25",
  toAmount: null,
  description: "Returned cash in May",
  date: new Date("2026-04-03T00:00:00.000Z"),
  createdAt: new Date("2026-04-03T00:00:00.000Z"),
  debt: {
    id: "debt-1",
    workspaceId: "workspace-1",
    type: DebtType.LENT,
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

describe("DebtTransactionItem", () => {
  it("renders the debt transaction description", () => {
    const markup = renderToStaticMarkup(
      <DebtTransactionItem debtTransaction={debtTransaction} workspaceName="Finnn" onClick={() => undefined} />
    );

    expect(markup).toContain("Returned cash in May");
  });
});
