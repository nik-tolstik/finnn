import { describe, expect, it } from "vitest";

import { formatMoney } from "../src/common/money";

describe("money helpers", () => {
  it("formats integer digits without losing precision", () => {
    expect(formatMoney("9007199254740993.25", "USD")).toBe("9 007 199 254 740 993.25$");
  });

  it("preserves the sign of negative sub-unit amounts", () => {
    expect(formatMoney("-0.10", "USD")).toBe("-0.10$");
  });
});
