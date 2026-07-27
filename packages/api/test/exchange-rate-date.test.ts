import { describe, expect, it } from "vitest";

import { getExchangeRateDateEnd, getExchangeRateDateStart } from "../src/currency/exchange-rate-date";

describe("exchange-rate date boundaries", () => {
  it("returns Minsk day boundaries independently of the process timezone", () => {
    const date = new Date("2026-03-30T22:15:00.000Z");

    expect(getExchangeRateDateStart(date).toISOString()).toBe("2026-03-30T21:00:00.000Z");
    expect(getExchangeRateDateEnd(date).toISOString()).toBe("2026-03-31T20:59:59.999Z");
  });
});
