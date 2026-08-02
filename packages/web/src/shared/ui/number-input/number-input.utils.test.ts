import { describe, expect, it } from "vitest";

import { normalizeNumberInputValue } from "./number-input.utils";

describe("normalize number input value", () => {
  it("removes a minus sign by default", () => {
    expect(normalizeNumberInputValue("-12.34")).toBe("12.34");
  });

  it("preserves one leading minus sign when negative values are allowed", () => {
    expect(normalizeNumberInputValue(" -12,34 ", true)).toBe("-12.34");
    expect(normalizeNumberInputValue("-", true)).toBe("-");
    expect(normalizeNumberInputValue("-.", true)).toBe("-.");
    expect(normalizeNumberInputValue("--12", true)).toBe("-12");
  });

  it("removes minus signs that are not leading", () => {
    expect(normalizeNumberInputValue("12-3", true)).toBe("123");
  });

  it("keeps only one decimal separator", () => {
    expect(normalizeNumberInputValue("-12.3.4", true)).toBe("-12.34");
  });
});
