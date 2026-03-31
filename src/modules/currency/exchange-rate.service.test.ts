import { Currency } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const upsertMock = vi.fn();
const getNBRBExchangeRatesMock = vi.fn();
const getNBRBExchangeRatesByDateMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    exchangeRate: {
      findMany: findManyMock,
      upsert: upsertMock,
    },
  },
}));

vi.mock("@/shared/lib/logger", () => ({
  serverLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarnMock,
    error: vi.fn(),
  },
}));

vi.mock("@/modules/currency/currency.service", () => ({
  getNBRBExchangeRates: getNBRBExchangeRatesMock,
  getNBRBExchangeRatesByDate: getNBRBExchangeRatesByDateMock,
}));

describe("exchange-rate.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a cross rate from stored BYN base rates without touching the API", async () => {
    findManyMock.mockResolvedValue([
      {
        date: new Date("2026-02-16T00:00:00.000Z"),
        fromCurrency: Currency.USD,
        rate: 3,
      },
      {
        date: new Date("2026-02-16T00:00:00.000Z"),
        fromCurrency: Currency.EUR,
        rate: 4,
      },
    ]);

    const { getExchangeRate } = await import("./exchange-rate.service");
    const result = await getExchangeRate(new Date("2026-02-16T14:10:00.000Z"), Currency.USD, Currency.EUR);

    expect(result).toEqual({ data: 0.75 });
    expect(getNBRBExchangeRatesByDateMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("fetches and saves missing base rates once for one day", async () => {
    findManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    upsertMock.mockResolvedValue({});
    getNBRBExchangeRatesByDateMock.mockResolvedValue({
      data: {
        BYN: 1,
        USD: 3,
        EUR: 4,
      },
    });

    const { preloadExchangeRates } = await import("./exchange-rate.service");
    const result = await preloadExchangeRates([
      {
        date: new Date("2026-02-16T10:00:00.000Z"),
        fromCurrency: Currency.USD,
        toCurrency: Currency.BYN,
      },
      {
        date: new Date("2026-02-16T15:00:00.000Z"),
        fromCurrency: Currency.USD,
        toCurrency: Currency.EUR,
      },
      {
        date: new Date("2026-02-16T18:00:00.000Z"),
        fromCurrency: Currency.USD,
        toCurrency: Currency.BYN,
      },
    ]);

    expect(result.size).toBe(2);
    expect(Array.from(result.values())).toEqual([3, 0.75]);
    expect(getNBRBExchangeRatesByDateMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fromCurrency: Currency.USD,
          toCurrency: Currency.BYN,
          rate: 3,
        }),
      })
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fromCurrency: Currency.EUR,
          toCurrency: Currency.BYN,
          rate: 4,
        }),
      })
    );
  });

  it("saves today's rates from the latest source", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T10:15:00.000Z"));

    upsertMock.mockResolvedValue({});
    getNBRBExchangeRatesMock.mockResolvedValue({
      data: {
        BYN: 1,
        USD: 2.95,
        EUR: 3.25,
      },
    });

    const { saveDailyExchangeRates } = await import("./exchange-rate.service");
    const savedRates = await saveDailyExchangeRates();
    const expectedDate = new Date("2026-03-31T10:15:00.000Z");
    expectedDate.setUTCHours(0, 0, 0, 0);

    expect(savedRates).toHaveLength(2);
    expect(getNBRBExchangeRatesMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          date: expectedDate,
          fromCurrency: Currency.USD,
          toCurrency: Currency.BYN,
          rate: 2.95,
        }),
      })
    );
  });
});
