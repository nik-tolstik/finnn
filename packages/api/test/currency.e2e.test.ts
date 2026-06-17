import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Currency } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CurrencyModule } from "../src/currency/currency.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

type MockPrisma = {
  exchangeRate: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function createNBRBResponse(usdRate: number, eurRate: number, rubRate = 3.5, rubScale = 100) {
  return createJsonResponse([
    {
      Cur_Abbreviation: "USD",
      Cur_OfficialRate: usdRate,
      Cur_Scale: 1,
    },
    {
      Cur_Abbreviation: "EUR",
      Cur_OfficialRate: eurRate,
      Cur_Scale: 1,
    },
    {
      Cur_Abbreviation: "RUB",
      Cur_OfficialRate: rubRate,
      Cur_Scale: rubScale,
    },
  ]);
}

function createPrismaMock(): MockPrisma {
  return {
    exchangeRate: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe("Currency API", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [CurrencyModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    process.env.CRON_SECRET = originalCronSecret;
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();

    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("returns a cross rate from stored BYN base rates without calling external providers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    prisma.exchangeRate.findMany.mockResolvedValue([
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

    const response = await request(app.getHttpServer())
      .get("/exchange-rates/rate")
      .query({
        date: "2026-02-16T14:10:00.000Z",
        fromCurrency: Currency.USD,
        toCurrency: Currency.EUR,
      })
      .expect(200);

    expect(response.body).toEqual({ data: 0.75 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.exchangeRate.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid exchange-rate query parameters", async () => {
    const response = await request(app.getHttpServer())
      .get("/exchange-rates/rate")
      .query({
        date: "not-a-date",
        fromCurrency: "GBP",
        toCurrency: Currency.BYN,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: "Bad Request",
      path: expect.stringContaining("/exchange-rates/rate"),
      statusCode: 400,
    });
    expect(response.body.message).toEqual(
      expect.arrayContaining([
        "date must be a Date instance",
        "fromCurrency must be one of the following values: USD, EUR, RUB, BYN",
      ])
    );
  });

  it("fetches and saves missing base rates for dated exchange-rate requests", async () => {
    prisma.exchangeRate.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.exchangeRate.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: create.fromCurrency, ...create })
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createNBRBResponse(3, 4)));

    const response = await request(app.getHttpServer())
      .get("/exchange-rates/rate")
      .query({
        date: "2026-02-16T14:10:00.000Z",
        fromCurrency: Currency.USD,
        toCurrency: Currency.BYN,
      })
      .expect(200);

    expect(response.body).toEqual({ data: 3 });
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fromCurrency: Currency.USD,
          rate: 3,
          toCurrency: Currency.BYN,
        }),
      })
    );
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fromCurrency: Currency.EUR,
          rate: 4,
          toCurrency: Currency.BYN,
        }),
      })
    );
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fromCurrency: Currency.RUB,
          rate: 0.035,
          toCurrency: Currency.BYN,
        }),
      })
    );
  });

  it("falls back to ExchangeRate-API when NBRB is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T10:15:00.000Z"));
    prisma.exchangeRate.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.exchangeRate.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: create.fromCurrency, ...create })
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse({ error: "unavailable" }, 503))
        .mockResolvedValueOnce(
          createJsonResponse({
            base: "BYN",
            date: "2026-03-31",
            rates: {
              EUR: 0.25,
              RUB: 100,
              USD: 0.5,
            },
          })
        )
    );

    const response = await request(app.getHttpServer()).get("/exchange-rates/today").expect(200);

    expect(response.body).toEqual({
      data: {
        EUR: 4,
        RUB: 0.01,
        USD: 2,
      },
    });
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledTimes(3);
  });

  it("protects the exchange-rate cron endpoint with CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-cron-secret";

    await request(app.getHttpServer())
      .get("/cron/update-exchange-rates")
      .set("Authorization", "Bearer wrong-secret")
      .expect(401);
  });

  it("persists daily exchange rates from the cron endpoint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T10:15:00.000Z"));
    process.env.CRON_SECRET = "test-cron-secret";
    prisma.exchangeRate.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: create.fromCurrency, ...create })
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createNBRBResponse(2.95, 3.25)));

    const response = await request(app.getHttpServer())
      .get("/cron/update-exchange-rates")
      .set("Authorization", "Bearer test-cron-secret")
      .expect(200);

    expect(response.body).toMatchObject({
      saved: 3,
      success: true,
    });
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          date: new Date("2026-03-31T00:00:00.000Z"),
          fromCurrency: Currency.USD,
          rate: 2.95,
          toCurrency: Currency.BYN,
        }),
      })
    );
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          date: new Date("2026-03-31T00:00:00.000Z"),
          fromCurrency: Currency.RUB,
          rate: 0.035,
          toCurrency: Currency.BYN,
        }),
      })
    );
  });
});
