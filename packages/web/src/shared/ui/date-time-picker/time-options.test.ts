import { describe, expect, it } from "vitest";

import { createTimeOptions, normalizeTimeInput } from "./time-options";

describe("date-time-picker time helpers", () => {
  it("creates 15-minute options for a full day", () => {
    const options = createTimeOptions(15);

    expect(options).toHaveLength(96);
    expect(options[0]).toEqual({ value: "00:00", label: "00:00" });
    expect(options.at(-1)).toEqual({ value: "23:45", label: "23:45" });
  });

  it("normalizes manually entered time values", () => {
    expect(normalizeTimeInput("9:05")).toBe("09:05");
    expect(normalizeTimeInput("09:05")).toBe("09:05");
  });

  it("rejects invalid time values", () => {
    expect(normalizeTimeInput("24:00")).toBeUndefined();
    expect(normalizeTimeInput("12:60")).toBeUndefined();
    expect(normalizeTimeInput("nope")).toBeUndefined();
  });

  it("allows valid custom values outside the option step", () => {
    expect(normalizeTimeInput("12:07")).toBe("12:07");
  });
});
