import { describe, expect, it } from "vitest";

import {
  addAccountBalanceDelta,
  applyPaymentTransactionBalance,
  getDebtDeletionBalanceDelta,
  getDebtInitialAccountBalanceDelta,
  getDebtTransactionBalanceDelta,
  getDebtTransactionTotalsDelta,
  getPaymentTransactionBalanceDelta,
  getTransferTransactionBalanceDeltas,
  revertPaymentTransactionBalance,
  shouldWarnAboutNegativeExpenseBalance,
} from "./balance-domain";

describe("balance domain helpers", () => {
  it("applies and reverts payment balances", () => {
    expect(applyPaymentTransactionBalance("100", "income", "25")).toBe("125");
    expect(applyPaymentTransactionBalance("100", "expense", "25")).toBe("75");
    expect(revertPaymentTransactionBalance("125", "income", "25")).toBe("100");
    expect(revertPaymentTransactionBalance("75", "expense", "25")).toBe("100");
    expect(getPaymentTransactionBalanceDelta("expense", "25")).toBe("-25");
  });

  it("warns only when an expense changes a non-negative balance to negative", () => {
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "125", "100", "-25")).toBe(true);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "1", "0", "-1")).toBe(true);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "10", "-5", "-15")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "10", "-15", "-5")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "100", "100", "0")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("income", "125", "100", "225")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "", "100", "-25")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "invalid", "100", "-25")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "0", "100", "-25")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "10", undefined, "-25")).toBe(false);
    expect(shouldWarnAboutNegativeExpenseBalance("expense", "10", "100", undefined)).toBe(false);
  });

  it("returns transfer account deltas", () => {
    expect(getTransferTransactionBalanceDeltas("10", "9.5")).toEqual({
      fromDelta: "-10",
      toDelta: "9.5",
    });
  });

  it("calculates debt create and add deltas", () => {
    expect(getDebtInitialAccountBalanceDelta("lent", "50")).toBe("-50");
    expect(getDebtInitialAccountBalanceDelta("borrowed", "50")).toBe("50");
    expect(getDebtTransactionBalanceDelta("lent", { type: "added", amount: "20" })).toBe("-20");
    expect(getDebtTransactionBalanceDelta("borrowed", { type: "added", amount: "20" })).toBe("20");
  });

  it("calculates debt close and delete deltas", () => {
    expect(getDebtTransactionBalanceDelta("lent", { type: "closed", amount: "30" })).toBe("30");
    expect(getDebtTransactionBalanceDelta("borrowed", { type: "closed", amount: "30" })).toBe("-30");
    expect(getDebtTransactionBalanceDelta("borrowed", { type: "closed", amount: "30", toAmount: "31" })).toBe("-31");
    expect(getDebtDeletionBalanceDelta("lent", { type: "closed", amount: "30" })).toBe("-30");
  });

  it("calculates debt total deltas", () => {
    expect(getDebtTransactionTotalsDelta("closed", "15")).toEqual({
      amountDelta: "0",
      remainingDelta: "-15",
    });
    expect(getDebtTransactionTotalsDelta("added", "15")).toEqual({
      amountDelta: "15",
      remainingDelta: "15",
    });
  });

  it("aggregates account deltas", () => {
    const deltas = new Map<string, string>();

    addAccountBalanceDelta(deltas, "account-1", "10");
    addAccountBalanceDelta(deltas, "account-1", "-3");
    addAccountBalanceDelta(deltas, null, "99");
    addAccountBalanceDelta(deltas, "account-2", "0");

    expect([...deltas.entries()]).toEqual([["account-1", "7"]]);
  });
});
