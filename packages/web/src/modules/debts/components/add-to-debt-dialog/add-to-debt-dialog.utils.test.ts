import { describe, expect, it } from "vitest";

import { DebtType } from "../../debt.constants";
import { getAddToDebtPreviewAccount, getAddToDebtSummaryPreview } from "./add-to-debt-dialog.utils";

describe("add to debt dialog utils", () => {
  it("previews negative balances when lending more than the account balance", () => {
    expect(
      getAddToDebtPreviewAccount({
        selectedAccount: { id: "account-1", balance: "10" },
        accountAmount: "20",
        debtType: DebtType.LENT,
      })
    ).toEqual({ id: "account-1", balance: "-10" });
  });

  it("previews borrowed debt additions as account income", () => {
    expect(
      getAddToDebtPreviewAccount({
        selectedAccount: { id: "account-1", balance: "10" },
        accountAmount: "20",
        debtType: DebtType.BORROWED,
      })
    ).toEqual({ id: "account-1", balance: "30" });
  });

  it("previews an additional amount in the debt summary", () => {
    expect(
      getAddToDebtSummaryPreview({
        additionalAmount: "25",
        remainingAmount: "75",
        totalAmount: "100",
      })
    ).toEqual({ remainingAmount: "100", totalAmount: "125" });
  });

  it.each([
    undefined,
    "",
    "0",
    "-1",
    ".",
    "not-a-number",
  ])("keeps authoritative debt values for an incomplete or non-positive addition: %s", (additionalAmount) => {
    expect(
      getAddToDebtSummaryPreview({
        additionalAmount,
        remainingAmount: "75",
        totalAmount: "100",
      })
    ).toEqual({ remainingAmount: "75", totalAmount: "100" });
  });

  it.each([
    ["1.", { remainingAmount: "76", totalAmount: "101" }],
    ["1,", { remainingAmount: "76", totalAmount: "101" }],
    [".5", { remainingAmount: "75.5", totalAmount: "100.5" }],
    [" 1,5 ", { remainingAmount: "76.5", totalAmount: "101.5" }],
  ])("normalizes an interim or comma-separated addition: %s", (additionalAmount, expectedPreview) => {
    expect(
      getAddToDebtSummaryPreview({
        additionalAmount,
        remainingAmount: "75",
        totalAmount: "100",
      })
    ).toEqual(expectedPreview);
  });

  it("preserves decimal and large money-string precision", () => {
    expect(
      getAddToDebtSummaryPreview({
        additionalAmount: "0.25",
        remainingAmount: "5000000000000001",
        totalAmount: "10000000000000001",
      })
    ).toEqual({
      remainingAmount: "5000000000000001.25",
      totalAmount: "10000000000000001.25",
    });
  });
});
