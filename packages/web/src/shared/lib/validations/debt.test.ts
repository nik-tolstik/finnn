import { describe, expect, it } from "vitest";

import { addToDebtSchema } from "./debt";

describe("debt validation schemas", () => {
  const validAddToDebtInput = {
    amount: "12.50",
    toAmount: "",
    useAccount: true,
    accountId: "account-1",
  } as const;

  it("requires an account when adding to a debt", () => {
    const result = addToDebtSchema.safeParse({ ...validAddToDebtInput, accountId: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["accountId"], message: "Выберите счёт" })
      );
    }
  });

  it("rejects an add-to-debt input that disables the required account", () => {
    expect(addToDebtSchema.safeParse({ ...validAddToDebtInput, useAccount: false }).success).toBe(false);
  });

  it("accepts an account-backed debt addition", () => {
    expect(addToDebtSchema.parse(validAddToDebtInput)).toEqual(validAddToDebtInput);
  });
});
