import { describe, expect, it } from "vitest";

import { CategoryType } from "@/modules/categories/category.constants";

import { DebtType } from "../../debt.constants";
import {
  getCloseDebtCategoryAmount,
  getCloseDebtCategoryType,
  getCloseDebtDefaultValues,
  getCloseDebtPreviewAccount,
} from "./close-debt-dialog.utils";

describe("close debt dialog utils", () => {
  it("builds default form values from a debt", () => {
    expect(getCloseDebtDefaultValues({ remainingAmount: "90" })).toEqual({
      amount: "90",
      paymentAmount: "90",
      toAmount: "",
      categoryId: undefined,
      accountId: "",
      description: "",
      useAccount: true,
    });
  });

  it("detects overpayment category type and amount", () => {
    expect(
      getCloseDebtCategoryType({
        debtType: DebtType.LENT,
        remainingAmount: "100",
        paymentAmount: "120",
        currenciesMatch: true,
      })
    ).toBe(CategoryType.INCOME);
    expect(
      getCloseDebtCategoryAmount({
        remainingAmount: "100",
        paymentAmount: "120",
        categoryType: CategoryType.INCOME,
      })
    ).toBe("20");
  });

  it("previews account balance with debt and category deltas", () => {
    expect(
      getCloseDebtPreviewAccount({
        selectedAccount: { id: "account-1", balance: "10", currency: "BYN" },
        debtType: DebtType.LENT,
        debtCurrency: "BYN",
        closeAmount: "100",
        paymentAmount: "120",
        toAmount: "",
        remainingAmount: "100",
        currenciesMatch: true,
      })
    ).toEqual({ id: "account-1", balance: "130", currency: "BYN" });

    expect(
      getCloseDebtPreviewAccount({
        selectedAccount: { id: "account-1", balance: "10", currency: "BYN" },
        debtType: DebtType.BORROWED,
        debtCurrency: "BYN",
        closeAmount: "100",
        paymentAmount: "100",
        toAmount: "",
        remainingAmount: "100",
        currenciesMatch: true,
      })
    ).toEqual({ id: "account-1", balance: "-90", currency: "BYN" });
  });
});
