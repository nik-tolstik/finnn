import { describe, expect, it } from "vitest";

import { createAccountSchema, updateAccountSchema } from "./account";

describe("account balance validation", () => {
  it.each(["-125", "-0.5", "0", "125.50"])("accepts signed money value %s", (value) => {
    expect(createAccountSchema.shape.initialBalance.safeParse(value).success).toBe(true);
  });

  it.each(["-", ".", "-.", "--1", "1-2", "12.3.4"])("rejects invalid money value %s", (value) => {
    expect(createAccountSchema.shape.initialBalance.safeParse(value).success).toBe(false);
  });

  it("allows an empty optional balance so account edits can omit it", () => {
    expect(updateAccountSchema.shape.initialBalance.safeParse("").success).toBe(true);
  });
});
