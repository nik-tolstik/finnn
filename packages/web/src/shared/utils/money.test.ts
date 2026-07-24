import { describe, expect, it } from "vitest";

import { formatMoney, normalizeMoneyString, normalizeOptionalMoneyString, roundMoney } from "./money";

describe("money utils", () => {
  it("normalizes localized money strings for API payloads", () => {
    expect(normalizeMoneyString(" 10,50 ")).toBe("10.50");
    expect(normalizeMoneyString("2 276,37")).toBe("2276.37");
    expect(normalizeMoneyString("2\u00a0276.37")).toBe("2276.37");
    expect(normalizeOptionalMoneyString("")).toBeUndefined();
    expect(normalizeOptionalMoneyString(null)).toBeUndefined();
  });

  it("formats integer digits without losing precision", () => {
    expect(formatMoney("9007199254740993.25", "USD")).toBe("9 007 199 254 740 993.25$");
  });

  it("preserves the sign of negative sub-unit amounts", () => {
    expect(formatMoney("-0.10", "USD")).toBe("-0.10$");
  });

  it("rounds money without converting through a JavaScript number", () => {
    expect(roundMoney("9007199254740993.255")).toBe("9007199254740993.26");
    expect(roundMoney("-1.005")).toBe("-1.01");
  });
});
