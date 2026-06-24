import { describe, expect, it } from "vitest";

import { PaymentTransactionType } from "../../transaction.constants";
import {
  getCategoryOptions,
  getCreatePaymentDefaultValues,
  getPreviewPaymentAccount,
  resolveSelectedAccount,
} from "./create-transaction-dialog.utils";

function createAccount(id: string) {
  return {
    id,
    workspaceId: "workspace-1",
    ownerId: "user-1",
    name: id,
    balance: "100",
    currency: "BYN",
    description: null,
    color: null,
    icon: null,
    archived: false,
    order: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("create transaction dialog utils", () => {
  it("builds compatible default payment form values", () => {
    const date = new Date("2026-01-10T10:00:00.000Z");

    expect(
      getCreatePaymentDefaultValues({
        accountId: "account-1",
        defaultType: PaymentTransactionType.EXPENSE,
        initialAmount: "12",
        initialDescription: "Lunch",
        initialDate: date,
        initialCategoryId: "category-1",
      })
    ).toEqual({
      accountId: "account-1",
      amount: "12",
      type: PaymentTransactionType.EXPENSE,
      description: "Lunch",
      date,
      categoryId: "category-1",
      newCategory: undefined,
    });
  });

  it("previews payment balance changes", () => {
    expect(getPreviewPaymentAccount({ id: "a1", balance: "100" }, PaymentTransactionType.INCOME, "25")).toEqual({
      id: "a1",
      balance: "125",
    });
    expect(getPreviewPaymentAccount({ id: "a1", balance: "100" }, PaymentTransactionType.EXPENSE, "25")).toEqual({
      id: "a1",
      balance: "75",
    });
  });

  it("builds category options for the selected transaction type", () => {
    expect(
      getCategoryOptions(
        [
          { id: "income", name: "Salary", type: PaymentTransactionType.INCOME },
          { id: "expense", name: "Food", type: PaymentTransactionType.EXPENSE },
        ],
        PaymentTransactionType.EXPENSE
      )
    ).toEqual([{ value: "expense", label: "Food" }]);
  });

  it("prefers the selected account id over the initial account prop", () => {
    const initialAccount = createAccount("account-1");
    const selectedAccount = createAccount("account-2");

    expect(
      resolveSelectedAccount({
        accountProp: { id: initialAccount.id },
        accountId: selectedAccount.id,
        accounts: [initialAccount, selectedAccount],
      })
    ).toEqual(selectedAccount);
  });
});
