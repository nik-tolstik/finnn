import { describe, expect, it } from "vitest";

import { addExchangeRateDateDays, getExchangeRateDateKey } from "./exchange-rate-date";

describe("getExchangeRateDateKey", () => {
  it("uses the Minsk calendar date around UTC midnight", () => {
    expect(getExchangeRateDateKey(new Date("2026-03-30T22:15:00.000Z"))).toBe("2026-03-31");
    expect(getExchangeRateDateKey(new Date("2026-03-30T20:59:59.999Z"))).toBe("2026-03-30");
  });

  it("rejects invalid dates", () => {
    expect(getExchangeRateDateKey(new Date("invalid"))).toBeNull();
  });

  it("moves calendar dates without relying on the browser timezone", () => {
    expect(addExchangeRateDateDays("2026-03-31", -1)).toBe("2026-03-30");
    expect(addExchangeRateDateDays("2026-03-31", 1)).toBe("2026-04-01");
  });
});
