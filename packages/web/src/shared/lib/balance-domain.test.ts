import { describe, expect, it } from "vitest";

import {
  addAccountBalanceDelta,
  applyPaymentTransactionBalance,
  assertNonNegativeBalance,
  getDebtDeletionBalanceDelta,
  getDebtInitialAccountBalanceDelta,
  getDebtTransactionBalanceDelta,
  getDebtTransactionTotalsDelta,
  getPaymentTransactionBalanceDelta,
  getTransferTransactionBalanceDeltas,
  revertPaymentTransactionBalance,
} from "./balance-domain";

describe("balance domain helpers", () => {
  it("applies and reverts payment balances", () => {
    expect(applyPaymentTransactionBalance("100", "income", "25")).toBe("125");
    expect(applyPaymentTransactionBalance("100", "expense", "25")).toBe("75");
    expect(revertPaymentTransactionBalance("125", "income", "25")).toBe("100");
    expect(revertPaymentTransactionBalance("75", "expense", "25")).toBe("100");
    expect(getPaymentTransactionBalanceDelta("expense", "25")).toBe("-25");
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

  it("aggregates account deltas and validates negative balances", () => {
    const deltas = new Map<string, string>();

    addAccountBalanceDelta(deltas, "account-1", "10");
    addAccountBalanceDelta(deltas, "account-1", "-3");
    addAccountBalanceDelta(deltas, null, "99");
    addAccountBalanceDelta(deltas, "account-2", "0");

    expect([...deltas.entries()]).toEqual([["account-1", "7"]]);
    expect(() => assertNonNegativeBalance("-0.01", "No money")).toThrow("No money");
    expect(() => assertNonNegativeBalance("0", "No money")).not.toThrow();
  });
});
