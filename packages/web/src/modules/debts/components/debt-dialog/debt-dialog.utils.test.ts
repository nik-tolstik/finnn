import { describe, expect, it } from "vitest";

import { DebtStatus, DebtType } from "../../debt.constants";
import {
  DEBT_DIALOG_DEFAULT_OPERATION,
  getDebtDialogCapabilities,
  getDebtDialogOperationOptions,
} from "./debt-dialog.utils";

describe("debt dialog configuration", () => {
  it("starts on repayment and labels the additional-lending segment for lent debts", () => {
    const debt = { status: DebtStatus.OPEN, type: DebtType.LENT };

    expect(DEBT_DIALOG_DEFAULT_OPERATION).toBe("close");
    expect(getDebtDialogOperationOptions(debt)).toEqual([
      { value: "close", label: "Погасить" },
      { value: "add", label: "Дать ещё" },
      { value: "transaction", label: "Транзакция" },
    ]);
  });

  it("labels the additional-borrowing segment for borrowed debts", () => {
    expect(getDebtDialogOperationOptions({ status: DebtStatus.OPEN, type: DebtType.BORROWED })[1]).toEqual({
      value: "add",
      label: "Взять ещё",
    });
  });

  it("keeps closed debts read-only while allowing deletion", () => {
    const debt = { status: DebtStatus.CLOSED, type: DebtType.LENT };

    expect(getDebtDialogOperationOptions(debt)).toEqual([]);
    expect(getDebtDialogCapabilities(debt)).toEqual({
      canDelete: true,
      canEdit: false,
      hasOperations: false,
    });
  });
});
