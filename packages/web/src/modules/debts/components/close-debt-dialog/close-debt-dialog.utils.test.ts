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
    expect(getCloseDebtDefaultValues({ remainingAmount: "90", accountId: "account-1" })).toEqual({
      amount: "90",
      paymentAmount: "90",
      toAmount: "",
      categoryId: undefined,
      closeEarly: false,
      accountId: "account-1",
      useAccount: true,
    });
  });

  it("detects gift category type and amount", () => {
    expect(
      getCloseDebtCategoryType({
        debtType: DebtType.LENT,
        remainingAmount: "100",
        paymentAmount: "80",
        closeEarly: true,
        currenciesMatch: true,
      })
    ).toBe(CategoryType.EXPENSE);
    expect(
      getCloseDebtCategoryAmount({
        remainingAmount: "100",
        paymentAmount: "80",
        closeEarly: true,
        categoryType: CategoryType.EXPENSE,
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
        paymentAmount: "80",
        toAmount: "",
        closeEarly: true,
        remainingAmount: "100",
        currenciesMatch: true,
      })
    ).toEqual({ id: "account-1", balance: "90", currency: "BYN" });
  });
});
