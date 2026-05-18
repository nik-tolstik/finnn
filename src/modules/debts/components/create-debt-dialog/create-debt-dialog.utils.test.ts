import { describe, expect, it } from "vitest";

import { DebtType } from "../../debt.constants";
import { getCreateDebtDefaultValues, getCreateDebtPreviewAccount } from "./create-debt-dialog.utils";

describe("create debt dialog utils", () => {
  it("builds default form values", () => {
    expect(getCreateDebtDefaultValues()).toMatchObject({
      type: DebtType.LENT,
      personName: "",
      amount: "",
      useAccount: true,
      accountId: "",
      currency: "BYN",
    });
  });

  it("previews account balance for lent and borrowed debts", () => {
    expect(
      getCreateDebtPreviewAccount({
        selectedAccount: { id: "account-1", balance: "100" },
        useAccount: true,
        amount: "40",
        debtType: DebtType.LENT,
      })
    ).toEqual({ id: "account-1", balance: "60" });

    expect(
      getCreateDebtPreviewAccount({
        selectedAccount: { id: "account-1", balance: "100" },
        useAccount: true,
        amount: "40",
        debtType: DebtType.BORROWED,
      })
    ).toEqual({ id: "account-1", balance: "140" });
  });
});
