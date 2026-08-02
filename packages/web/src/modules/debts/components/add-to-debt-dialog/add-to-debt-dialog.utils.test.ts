import { describe, expect, it } from "vitest";

import { DebtType } from "../../debt.constants";
import { getAddToDebtPreviewAccount } from "./add-to-debt-dialog.utils";

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
});
