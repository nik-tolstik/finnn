import { describe, expect, it } from "vitest";

import { PaymentTransactionType } from "../../transaction.constants";
import { getEditPaymentPreviewAccount, getPaymentAccountBalanceBeforeEdit } from "./edit-transaction-dialog.utils";

const expenseTransaction = {
  accountId: "account-1",
  type: PaymentTransactionType.EXPENSE,
  amount: "25",
};

describe("edit transaction dialog utils", () => {
  it("reverts the existing payment before previewing the edited amount", () => {
    expect(getPaymentAccountBalanceBeforeEdit({ id: "account-1", balance: "75" }, expenseTransaction)).toBe("100");
    expect(getEditPaymentPreviewAccount({ id: "account-1", balance: "75" }, expenseTransaction, "10")).toEqual({
      id: "account-1",
      balance: "90",
    });
  });

  it("previews against the selected account balance when account changed", () => {
    expect(getEditPaymentPreviewAccount({ id: "account-2", balance: "50" }, expenseTransaction, "10")).toEqual({
      id: "account-2",
      balance: "40",
    });
  });
});
