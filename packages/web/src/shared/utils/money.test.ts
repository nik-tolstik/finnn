import { describe, expect, it } from "vitest";

import { normalizeMoneyString, normalizeOptionalMoneyString } from "./money";

describe("money utils", () => {
  it("normalizes localized money strings for API payloads", () => {
    expect(normalizeMoneyString(" 10,50 ")).toBe("10.50");
    expect(normalizeOptionalMoneyString("")).toBeUndefined();
    expect(normalizeOptionalMoneyString(null)).toBeUndefined();
  });
});
