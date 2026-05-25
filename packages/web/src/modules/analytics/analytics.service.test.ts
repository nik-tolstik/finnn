import { Currency } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

const paymentFindManyMock = vi.fn();
const transferFindManyMock = vi.fn();
const debtTransactionFindManyMock = vi.fn();
const debtFindManyMock = vi.fn();
const requireWorkspaceAccessMock = vi.fn();
const getWorkspaceSummaryMock = vi.fn();
const preloadExchangeRatesMock = vi.fn();

vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    paymentTransaction: {
      findMany: paymentFindManyMock,
    },
    transferTransaction: {
      findMany: transferFindManyMock,
    },
    debtTransaction: {
      findMany: debtTransactionFindManyMock,
    },
    debt: {
      findMany: debtFindManyMock,
    },
  },
}));

vi.mock("@/shared/lib/server-access", () => ({
  requireWorkspaceAccess: requireWorkspaceAccessMock,
}));

vi.mock("@/modules/workspace/workspace.service", () => ({
  getWorkspaceSummary: getWorkspaceSummaryMock,
}));

vi.mock("@/modules/currency/exchange-rate.service", () => ({
  preloadExchangeRates: preloadExchangeRatesMock,
}));

function createRateKey(date: string, fromCurrency: Currency, toCurrency: Currency) {
  return `${date}:${fromCurrency}:${toCurrency}`;
}

describe("analytics.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceAccessMock.mockResolvedValue({ userId: "user-1" });
    getWorkspaceSummaryMock.mockResolvedValue({
      data: {
        id: "workspace-1",
        name: "Workspace",
        icon: null,
        baseCurrency: Currency.BYN,
        ownerId: "user-1",
      },
    });
  });

  it("aggregates converted analytics totals, comparisons, open debts, and largest movements", async () => {
    paymentFindManyMock
      .mockResolvedValueOnce([
        {
          id: "income-1",
          workspaceId: "workspace-1",
          accountId: "account-usd",
          amount: "100",
          type: PaymentTransactionType.INCOME,
          description: "Зарплата",
          date: new Date("2026-04-01T00:00:00.000Z"),
          categoryId: "category-income",
          account: {
            id: "account-usd",
            name: "USD Wallet",
            currency: Currency.USD,
            color: null,
            icon: null,
            ownerId: "user-1",
            owner: {
              id: "user-1",
              name: "Alex",
              email: "alex@example.com",
              image: null,
            },
          },
          category: {
            id: "category-income",
            name: "Зарплата",
          },
        },
        {
          id: "expense-1",
          workspaceId: "workspace-1",
          accountId: "account-eur",
          amount: "50",
          type: PaymentTransactionType.EXPENSE,
          description: "Супермаркет",
          date: new Date("2026-04-01T00:00:00.000Z"),
          categoryId: "category-food",
          account: {
            id: "account-eur",
            name: "EUR Card",
            currency: Currency.EUR,
            color: null,
            icon: null,
            ownerId: "user-1",
            owner: {
              id: "user-1",
              name: "Alex",
              email: "alex@example.com",
              image: null,
            },
          },
          category: {
            id: "category-food",
            name: "Продукты",
          },
        },
        {
          id: "expense-2",
          workspaceId: "workspace-1",
          accountId: "account-byn",
          amount: "25",
          type: PaymentTransactionType.EXPENSE,
          description: "Автобус",
          date: new Date("2026-04-02T00:00:00.000Z"),
          categoryId: "category-transport",
          account: {
            id: "account-byn",
            name: "BYN Card",
            currency: Currency.BYN,
            color: null,
            icon: null,
            ownerId: "user-1",
            owner: {
              id: "user-1",
              name: "Alex",
              email: "alex@example.com",
              image: null,
            },
          },
          category: {
            id: "category-transport",
            name: "Транспорт",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "income-prev",
          workspaceId: "workspace-1",
          accountId: "account-usd",
          amount: "80",
          type: PaymentTransactionType.INCOME,
          description: "Прошлая зарплата",
          date: new Date("2026-03-29T00:00:00.000Z"),
          categoryId: "category-income",
          account: {
            id: "account-usd",
            name: "USD Wallet",
            currency: Currency.USD,
            color: null,
            icon: null,
            ownerId: "user-1",
            owner: {
              id: "user-1",
              name: "Alex",
              email: "alex@example.com",
              image: null,
            },
          },
          category: {
            id: "category-income",
            name: "Зарплата",
          },
        },
        {
          id: "expense-prev",
          workspaceId: "workspace-1",
          accountId: "account-eur",
          amount: "40",
          type: PaymentTransactionType.EXPENSE,
          description: "Прошлые продукты",
          date: new Date("2026-03-30T00:00:00.000Z"),
          categoryId: "category-food",
          account: {
            id: "account-eur",
            name: "EUR Card",
            currency: Currency.EUR,
            color: null,
            icon: null,
            ownerId: "user-1",
            owner: {
              id: "user-1",
              name: "Alex",
              email: "alex@example.com",
              image: null,
            },
          },
          category: {
            id: "category-food",
            name: "Продукты",
          },
        },
      ]);

    transferFindManyMock.mockResolvedValue([
      {
        id: "transfer-1",
        workspaceId: "workspace-1",
        fromAccountId: "account-usd",
        toAccountId: "account-byn",
        amount: "10",
        toAmount: "30",
        description: "Пополнение",
        date: new Date("2026-04-02T00:00:00.000Z"),
        fromAccount: {
          id: "account-usd",
          name: "USD Wallet",
          currency: Currency.USD,
          color: null,
          icon: null,
          ownerId: "user-1",
          owner: {
            id: "user-1",
            name: "Alex",
            email: "alex@example.com",
            image: null,
          },
        },
        toAccount: {
          id: "account-byn",
          name: "BYN Card",
          currency: Currency.BYN,
          color: null,
          icon: null,
          ownerId: "user-1",
          owner: {
            id: "user-1",
            name: "Alex",
            email: "alex@example.com",
            image: null,
          },
        },
      },
    ]);

    debtTransactionFindManyMock.mockResolvedValue([
      {
        id: "debt-close-1",
        workspaceId: "workspace-1",
        debtId: "debt-alice",
        accountId: "account-byn",
        type: DebtTransactionType.CLOSED,
        amount: "20",
        toAmount: "60",
        date: new Date("2026-04-03T00:00:00.000Z"),
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        debt: {
          id: "debt-alice",
          workspaceId: "workspace-1",
          type: DebtType.LENT,
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
        account: {
          id: "account-byn",
          name: "BYN Card",
          currency: Currency.BYN,
          color: null,
          icon: null,
          ownerId: "user-1",
          owner: {
            id: "user-1",
            name: "Alex",
            email: "alex@example.com",
            image: null,
          },
        },
      },
    ]);

    debtFindManyMock.mockResolvedValue([
      {
        id: "debt-alice",
        personName: "Alice",
        type: DebtType.LENT,
        remainingAmount: "40",
        currency: Currency.USD,
        date: new Date("2026-03-15T00:00:00.000Z"),
      },
      {
        id: "debt-bob",
        personName: "Bob",
        type: DebtType.BORROWED,
        remainingAmount: "30",
        currency: Currency.EUR,
        date: new Date("2026-03-10T00:00:00.000Z"),
      },
    ]);

    preloadExchangeRatesMock.mockResolvedValue(
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

    const { getAnalyticsOverview } = await import("./analytics.service");
    const result = await getAnalyticsOverview("workspace-1", {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-03",
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.baseCurrency).toBe(Currency.BYN);
    expect(result.summary.income.totalInBaseCurrency).toBe("300");
    expect(result.summary.expense.totalInBaseCurrency).toBe("225");
    expect(result.summary.netFlow.totalInBaseCurrency).toBe("75");
    expect(result.summary.transferVolume.totalInBaseCurrency).toBe("30");
    expect(result.summary.transferVolume.transactionCount).toBe(1);
    expect(result.summary.openDebts.totalInBaseCurrency).toBe("240");
    expect(result.summary.openDebts.debtCount).toBe(2);
    expect(result.summary.income.percentageChange).toBe(25);
    expect(result.summary.expense.percentageChange).toBe(40.6);
    expect(result.summary.netFlow.percentageChange).toBe(-6.3);
    expect(result.comparison.incomePreviousTotalInBaseCurrency).toBe("240");
    expect(result.comparison.expensePreviousTotalInBaseCurrency).toBe("160");
    expect(result.comparison.netFlowPreviousTotalInBaseCurrency).toBe("80");

    expect(result.timeSeries).toEqual([
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

    expect(result.expenseCategories).toEqual([
      {
        id: "category-food",
        name: "Продукты",
        totalInBaseCurrency: "200",
        transactionCount: 1,
        sharePercent: 88.9,
      },
      {
        id: "category-transport",
        name: "Транспорт",
        totalInBaseCurrency: "25",
        transactionCount: 1,
        sharePercent: 11.1,
      },
    ]);

    expect(result.debtsByPerson).toEqual([
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

    expect(result.largestMovements).toHaveLength(5);
    expect(result.largestMovements[0]).toMatchObject({
      id: "income-1",
      kind: "paymentTransaction",
      amountInBaseCurrency: "300.00 Br",
    });
    expect(result.largestMovements[1]).toMatchObject({
      id: "expense-1",
      kind: "paymentTransaction",
      amountInBaseCurrency: "200.00 Br",
    });
    expect(result.largestMovements[2]).toMatchObject({
      id: "debt-close-1",
      kind: "debtTransaction",
      amountInBaseCurrency: "60.00 Br",
      originalAmount: "60.00 Br",
    });
  });
});
