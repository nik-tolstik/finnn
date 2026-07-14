import { describe, expect, it } from "vitest";

import { getExchangeRateDateKey } from "./exchange-rate-date";

describe("getExchangeRateDateKey", () => {
  it("uses the Minsk calendar date around UTC midnight", () => {
    expect(getExchangeRateDateKey(new Date("2026-03-30T22:15:00.000Z"))).toBe("2026-03-31");
    expect(getExchangeRateDateKey(new Date("2026-03-30T20:59:59.999Z"))).toBe("2026-03-30");
  });

  it("rejects invalid dates", () => {
    expect(getExchangeRateDateKey(new Date("invalid"))).toBeNull();
  });
});
