import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createAbortableFetchResponse() {
  return (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectWithAbortError = () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      };

      if (init?.signal?.aborted) {
        rejectWithAbortError();
        return;
      }

      init?.signal?.addEventListener("abort", rejectWithAbortError, { once: true });
    });
}

function createNBRBResponse(usdRate: number, eurRate: number) {
  return createJsonResponse([
    {
      Cur_ID: 1,
      Date: "2026-02-16T00:00:00",
      Cur_Abbreviation: "USD",
      Cur_Scale: 1,
      Cur_Name: "US Dollar",
      Cur_OfficialRate: usdRate,
    },
    {
      Cur_ID: 2,
      Date: "2026-02-16T00:00:00",
      Cur_Abbreviation: "EUR",
      Cur_Scale: 1,
      Cur_Name: "Euro",
      Cur_OfficialRate: eurRate,
    },
  ]);
}

describe("currency.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("deduplicates parallel requests for the same date", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createNBRBResponse(3, 4));
    vi.stubGlobal("fetch", fetchMock);

    const { getNBRBExchangeRatesByDate } = await import("./currency.service");
    const date = new Date("2026-02-16T12:45:00.000Z");

    const [first, second] = await Promise.all([getNBRBExchangeRatesByDate(date), getNBRBExchangeRatesByDate(date)]);

    expect(first).toEqual({
      data: {
        BYN: 1,
        USD: 3,
        EUR: 4,
      },
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back immediately after an NBRB timeout", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(createAbortableFetchResponse())
      .mockResolvedValueOnce(
        createJsonResponse({
          base: "BYN",
          date: "2026-02-16",
          rates: {
            USD: 0.5,
            EUR: 0.25,
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { getNBRBExchangeRatesByDate } = await import("./currency.service");

    const firstRequest = getNBRBExchangeRatesByDate(new Date("2026-02-16T00:00:00.000Z"));
    await vi.advanceTimersByTimeAsync(3000);

    expect(await firstRequest).toEqual({
      data: {
        BYN: 1,
        USD: 2,
        EUR: 4,
      },
    });

    expect(await getNBRBExchangeRatesByDate(new Date("2026-02-17T00:00:00.000Z"))).toEqual({
      data: {
        BYN: 1,
        USD: 2,
        EUR: 4,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
