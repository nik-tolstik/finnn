import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Currency } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsModule } from "../src/analytics/analytics.module";
import { AUTH_COOKIE_NAME } from "../src/auth/session-cookie";
import { ExchangeRateService } from "../src/currency/exchange-rate.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

type MockPrisma = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  authSession: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  workspace: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  workspaceMember: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    findMany: ReturnType<typeof vi.fn>;
  };
  transferTransaction: {
    findMany: ReturnType<typeof vi.fn>;
  };
  debtTransaction: {
    findMany: ReturnType<typeof vi.fn>;
  };
  debt: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

type MockExchangeRateService = {
  preloadExchangeRates: ReturnType<typeof vi.fn>;
};

function createPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
    },
    authSession: {
      findFirst: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
    paymentTransaction: {
      findMany: vi.fn(),
    },
    transferTransaction: {
      findMany: vi.fn(),
    },
    debtTransaction: {
      findMany: vi.fn(),
    },
    debt: {
      findMany: vi.fn(),
    },
  };
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

const owner = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

function createAccountRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-byn",
    workspaceId: "workspace-1",
    ownerId: "user-1",
    name: "BYN Card",
    balance: "100",
    currency: Currency.BYN,
    description: null,
    color: null,
    icon: null,
    archived: false,
    order: 0,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    owner,
    ...overrides,
  };
}

function createPaymentTransactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-1",
    workspaceId: "workspace-1",
    accountId: "account-byn",
    amount: "25",
    type: "expense",
    description: "Groceries",
    date: new Date("2026-04-01T00:00:00.000Z"),
    categoryId: "category-food",
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    account: createAccountRecord(),
    category: {
      id: "category-food",
      name: "Продукты",
    },
    ...overrides,
  };
}

function createTransferTransactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    workspaceId: "workspace-1",
    fromAccountId: "account-usd",
    toAccountId: "account-byn",
    createdById: currentUser.id,
    amount: "10",
    toAmount: "30",
    description: "Пополнение",
    date: new Date("2026-04-02T00:00:00.000Z"),
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    fromAccount: createAccountRecord({
      id: "account-usd",
      name: "USD Wallet",
      currency: Currency.USD,
    }),
    toAccount: createAccountRecord(),
    createdBy: currentUser,
    ...overrides,
  };
}

function createDebtTransactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-close-1",
    workspaceId: "workspace-1",
    debtId: "debt-alice",
    accountId: "account-byn",
    type: "closed",
    amount: "20",
    toAmount: "60",
    date: new Date("2026-04-03T00:00:00.000Z"),
    createdAt: new Date("2026-04-03T00:00:00.000Z"),
    debt: {
      id: "debt-alice",
      workspaceId: "workspace-1",
      type: "lent",
      personName: "Alice",
      amount: "100",
      remainingAmount: "40",
      currency: Currency.EUR,
      accountId: "account-byn",
      date: new Date("2026-03-15T00:00:00.000Z"),
      status: "open",
      createdAt: new Date("2026-03-15T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
    },
    account: createAccountRecord(),
    ...overrides,
  };
}

function createOpenDebtRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-alice",
    personName: "Alice",
    type: "lent",
    remainingAmount: "40",
    currency: Currency.USD,
    date: new Date("2026-03-15T00:00:00.000Z"),
    ...overrides,
  };
}

function createRateKey(date: string, fromCurrency: Currency, toCurrency: Currency) {
  return `${date}:${fromCurrency}:${toCurrency}`;
}

function mockAuthenticatedSession(prisma: MockPrisma) {
  prisma.authSession.findFirst.mockResolvedValue({ userId: currentUser.id });
  prisma.user.findUnique.mockResolvedValue(currentUser);
}

function mockEmptyAnalyticsData(prisma: MockPrisma) {
  prisma.paymentTransaction.findMany.mockResolvedValue([]);
  prisma.transferTransaction.findMany.mockResolvedValue([]);
  prisma.debtTransaction.findMany.mockResolvedValue([]);
  prisma.debt.findMany.mockResolvedValue([]);
}

describe("Analytics API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;
  let exchangeRateService: MockExchangeRateService;

  beforeAll(async () => {
    prisma = createPrismaMock();
    exchangeRateService = {
      preloadExchangeRates: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AnalyticsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ExchangeRateService)
      .useValue(exchangeRateService)
      .compile();

    app = configureApp(moduleRef.createNestApplication(), {
      API_COOKIE_SAME_SITE: "lax",
      API_COOKIE_SECURE: "false",
    } as NodeJS.ProcessEnv);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.authSession.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspace.findUnique.mockResolvedValue({
      ownerId: currentUser.id,
      baseCurrency: Currency.BYN,
    });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    mockEmptyAnalyticsData(prisma);
    exchangeRateService.preloadExchangeRates.mockResolvedValue(new Map());
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated analytics reads", async () => {
    await request(app.getHttpServer()).get("/workspaces/workspace-1/analytics/overview").expect(401);
  });

  it("denies analytics reads outside the workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-2", baseCurrency: Currency.BYN });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);
  });

  it("aggregates converted totals, comparisons, open debts, and largest movements", async () => {
    mockAuthenticatedSession(prisma);
    prisma.paymentTransaction.findMany
      .mockResolvedValueOnce([
        createPaymentTransactionRecord({
          id: "income-1",
          amount: "100",
          type: "income",
          description: "Зарплата",
          account: createAccountRecord({
            id: "account-usd",
            name: "USD Wallet",
            currency: Currency.USD,
          }),
          category: {
            id: "category-income",
            name: "Зарплата",
          },
        }),
        createPaymentTransactionRecord({
          id: "expense-1",
          amount: "50",
          account: createAccountRecord({
            id: "account-eur",
            name: "EUR Card",
            currency: Currency.EUR,
          }),
        }),
        createPaymentTransactionRecord({
          id: "expense-2",
          amount: "25",
          date: new Date("2026-04-02T00:00:00.000Z"),
          category: {
            id: "category-transport",
            name: "Транспорт",
          },
        }),
      ])
      .mockResolvedValueOnce([
        createPaymentTransactionRecord({
          id: "income-prev",
          amount: "80",
          type: "income",
          date: new Date("2026-03-29T00:00:00.000Z"),
          account: createAccountRecord({
            id: "account-usd",
            name: "USD Wallet",
            currency: Currency.USD,
          }),
        }),
        createPaymentTransactionRecord({
          id: "expense-prev",
          amount: "40",
          date: new Date("2026-03-30T00:00:00.000Z"),
          account: createAccountRecord({
            id: "account-eur",
            name: "EUR Card",
            currency: Currency.EUR,
          }),
        }),
      ]);
    prisma.transferTransaction.findMany.mockResolvedValue([createTransferTransactionRecord()]);
    prisma.debtTransaction.findMany.mockResolvedValue([createDebtTransactionRecord()]);
    prisma.debt.findMany.mockResolvedValue([
      createOpenDebtRecord(),
      createOpenDebtRecord({
        id: "debt-bob",
        personName: "Bob",
        type: "borrowed",
        remainingAmount: "30",
        currency: Currency.EUR,
        date: new Date("2026-03-10T00:00:00.000Z"),
      }),
    ]);
    exchangeRateService.preloadExchangeRates.mockResolvedValue(
      new Map([
        [createRateKey("2026-04-01", Currency.USD, Currency.BYN), 3],
        [createRateKey("2026-04-01", Currency.EUR, Currency.BYN), 4],
        [createRateKey("2026-04-02", Currency.USD, Currency.BYN), 3],
        [createRateKey("2026-03-29", Currency.USD, Currency.BYN), 3],
        [createRateKey("2026-03-30", Currency.EUR, Currency.BYN), 4],
        [createRateKey("2026-03-15", Currency.USD, Currency.BYN), 3],
        [createRateKey("2026-03-10", Currency.EUR, Currency.BYN), 4],
      ])
    );

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .query({ dateFrom: "2026-04-01", dateTo: "2026-04-03" })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.baseCurrency).toBe(Currency.BYN);
    expect(response.body.summary.income.totalInBaseCurrency).toBe("300");
    expect(response.body.summary.expense.totalInBaseCurrency).toBe("225");
    expect(response.body.summary.netFlow.totalInBaseCurrency).toBe("75");
    expect(response.body.summary.transferVolume.totalInBaseCurrency).toBe("30");
    expect(response.body.summary.openDebts.totalInBaseCurrency).toBe("240");
    expect(response.body.summary.income.percentageChange).toBe(25);
    expect(response.body.summary.expense.percentageChange).toBe(40.6);
    expect(response.body.comparison.netFlowPreviousTotalInBaseCurrency).toBe("80");
    expect(response.body.timeSeries).toEqual([
      {
        date: "2026-04-01",
        incomeTotalInBaseCurrency: "300",
        expenseTotalInBaseCurrency: "200",
      },
      {
        date: "2026-04-02",
        incomeTotalInBaseCurrency: "0",
        expenseTotalInBaseCurrency: "25",
      },
      {
        date: "2026-04-03",
        incomeTotalInBaseCurrency: "0",
        expenseTotalInBaseCurrency: "0",
      },
    ]);
    expect(response.body.incomeCategories[0]).toMatchObject({
      id: "category-income",
      totalInBaseCurrency: "300",
      sharePercent: 100,
    });
    expect(response.body.expenseCategories[0]).toMatchObject({
      id: "category-food",
      totalInBaseCurrency: "200",
      sharePercent: 88.9,
    });
    expect(response.body.debtsByPerson).toEqual([
      {
        personName: "Alice",
        lentTotalInBaseCurrency: "120",
        borrowedTotalInBaseCurrency: "0",
        netExposureInBaseCurrency: "120",
        debtCount: 1,
      },
      {
        personName: "Bob",
        lentTotalInBaseCurrency: "0",
        borrowedTotalInBaseCurrency: "120",
        netExposureInBaseCurrency: "-120",
        debtCount: 1,
      },
    ]);
    expect(response.body.largestMovements.slice(0, 3)).toEqual([
      expect.objectContaining({
        amountInBaseCurrency: "300.00 Br",
        id: "income-1",
        kind: "paymentTransaction",
      }),
      expect.objectContaining({
        amountInBaseCurrency: "200.00 Br",
        id: "expense-1",
        kind: "paymentTransaction",
      }),
      expect.objectContaining({
        amountInBaseCurrency: "60.00 Br",
        id: "debt-close-1",
        kind: "debtTransaction",
        originalAmount: "60.00 Br",
      }),
    ]);
  });

  it("uses a 30-day implicit range and normalizes reversed explicit ranges", async () => {
    mockAuthenticatedSession(prisma);

    const implicitResponse = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(implicitResponse.body.effectiveRange.dayCount).toBe(30);
    expect(implicitResponse.body.effectiveRange.isImplicit).toBe(true);

    const reversedResponse = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .query({ dateFrom: "2026-04-05", dateTo: "2026-04-01" })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(reversedResponse.body.effectiveRange).toMatchObject({
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      dayCount: 5,
      isImplicit: false,
    });
  });

  it("excludes debt transactions when the transaction type filter omits debt but keeps open debt totals", async () => {
    mockAuthenticatedSession(prisma);
    prisma.paymentTransaction.findMany.mockResolvedValue([]);
    prisma.debt.findMany.mockResolvedValue([createOpenDebtRecord()]);
    exchangeRateService.preloadExchangeRates.mockResolvedValue(
      new Map([[createRateKey("2026-03-15", Currency.USD, Currency.BYN), 3]])
    );

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .query({ transactionTypes: ["income", "expense"], dateFrom: "2026-04-01", dateTo: "2026-04-03" })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(prisma.debtTransaction.findMany).not.toHaveBeenCalled();
    expect(response.body.summary.openDebts.totalInBaseCurrency).toBe("120");
    expect(response.body.summary.openDebts.debtCount).toBe(1);
  });

  it("applies amount and category filters across mixed transaction types", async () => {
    mockAuthenticatedSession(prisma);
    prisma.paymentTransaction.findMany
      .mockResolvedValueOnce([
        createPaymentTransactionRecord({ id: "small-payment", amount: "5" }),
        createPaymentTransactionRecord({ id: "large-payment", amount: "50" }),
      ])
      .mockResolvedValueOnce([]);
    prisma.transferTransaction.findMany.mockResolvedValue([
      createTransferTransactionRecord({ id: "large-transfer", amount: "7", toAmount: "80" }),
    ]);
    prisma.debtTransaction.findMany.mockResolvedValue([createDebtTransactionRecord({ amount: "60" })]);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .query({ amountFrom: "40", categoryIds: ["category-food"], dateFrom: "2026-04-01", dateTo: "2026-04-03" })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.summary.expense.totalInBaseCurrency).toBe("50");
    expect(response.body.summary.transferVolume.totalInBaseCurrency).toBe("0");
    expect(response.body.largestMovements).toEqual([
      expect.objectContaining({
        id: "large-payment",
        kind: "paymentTransaction",
      }),
    ]);
  });

  it("returns an API error when exchange rates are unavailable", async () => {
    mockAuthenticatedSession(prisma);
    prisma.paymentTransaction.findMany
      .mockResolvedValueOnce([
        createPaymentTransactionRecord({
          account: createAccountRecord({
            currency: Currency.USD,
          }),
        }),
      ])
      .mockResolvedValueOnce([]);
    exchangeRateService.preloadExchangeRates.mockRejectedValue(new Error("Курс для USD/BYN на 2026-04-01 не найден"));

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/analytics/overview")
      .query({ dateFrom: "2026-04-01", dateTo: "2026-04-03" })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(503);

    expect(response.body.message).toBe("Курс для USD/BYN на 2026-04-01 не найден");
  });
});
