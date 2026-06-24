import { describe, expect, it } from "vitest";

import { CategoryType } from "@/modules/categories/category.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

import {
  createPaymentTransactionSchema,
  createTransferTransactionSchema,
  updatePaymentTransactionSchema,
} from "./transaction";

describe("transaction validation schemas", () => {
  it("normalizes spaced localized payment amounts before returning form values", () => {
    const result = createPaymentTransactionSchema.parse({
      accountId: "account-1",
      amount: "2 276,37",
      type: PaymentTransactionType.EXPENSE,
      description: "Groceries",
      date: new Date("2026-06-24T12:00:00.000Z"),
      categoryId: "category-1",
      newCategory: { name: "Food", type: CategoryType.EXPENSE },
    });

    expect(result.amount).toBe("2276.37");
  });

  it("normalizes transfer and optional update amounts", () => {
    expect(
      createTransferTransactionSchema.parse({
        fromAccountId: "account-1",
        toAccountId: "account-2",
        amount: "1\u00a0000,25",
        toAmount: "999,75",
        date: new Date("2026-06-24T12:00:00.000Z"),
      })
    ).toEqual(
      expect.objectContaining({
        amount: "1000.25",
        toAmount: "999.75",
      })
    );

    expect(updatePaymentTransactionSchema.parse({ amount: "3 000,50" })).toEqual({ amount: "3000.50" });
  });
});
