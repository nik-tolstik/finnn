import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

const getApiAnalyticsOverviewMock = vi.fn();
const getServerApiRequestOptionsMock = vi.fn();

vi.mock("@/shared/api/generated/analytics/analytics", () => ({
  getAnalyticsOverview: getApiAnalyticsOverviewMock,
}));

vi.mock("@/shared/lib/api-session", () => ({
  getServerApiRequestOptions: getServerApiRequestOptionsMock,
}));

const requestOptions = {
  cache: "no-store",
  headers: { cookie: "finnn_session=token" },
};

function createAnalyticsOverviewDto(overrides: Record<string, unknown> = {}) {
  return {
    baseCurrency: "BYN",
    effectiveRange: {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      previousStartDate: "2026-03-02",
      previousEndDate: "2026-03-31",
      dayCount: 30,
      isImplicit: false,
    },
    summary: {
      income: {
        totalInBaseCurrency: "300",
        previousTotalInBaseCurrency: "200",
        percentageChange: 50,
        transactionCount: 2,
      },
      expense: {
        totalInBaseCurrency: "120",
        previousTotalInBaseCurrency: "100",
        transactionCount: 3,
      },
      netFlow: {
        totalInBaseCurrency: "180",
        previousTotalInBaseCurrency: "100",
      },
      transferVolume: {
        totalInBaseCurrency: "75",
        transactionCount: 1,
      },
      openDebts: {
        totalInBaseCurrency: "90",
        debtCount: 2,
      },
    },
    comparison: {
      incomePreviousTotalInBaseCurrency: "200",
      expensePreviousTotalInBaseCurrency: "100",
      netFlowPreviousTotalInBaseCurrency: "100",
    },
    timeSeries: [
      {
        date: "2026-04-01",
        incomeTotalInBaseCurrency: "300",
        expenseTotalInBaseCurrency: "120",
      },
    ],
    expenseCategories: [
      {
        id: "category-1",
        name: "Food",
        totalInBaseCurrency: "120",
        transactionCount: 3,
        sharePercent: 100,
      },
    ],
    debtsByPerson: [
      {
        personName: "Alex",
        lentTotalInBaseCurrency: "90",
        borrowedTotalInBaseCurrency: "0",
        netExposureInBaseCurrency: "90",
        debtCount: 2,
      },
    ],
    largestMovements: [
      {
        id: "payment-1",
        kind: "paymentTransaction",
        kindLabel: "Доход",
        date: "2026-04-01",
        primaryLabel: "Salary",
        secondaryLabel: "Account",
        originalAmount: "100 USD",
        amountInBaseCurrency: "300 BYN",
      },
    ],
    ...overrides,
  };
}

describe("analytics.service API adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerApiRequestOptionsMock.mockResolvedValue(requestOptions);
  });

  it("forwards filters and request options to the generated analytics client", async () => {
    getApiAnalyticsOverviewMock.mockResolvedValue(createAnalyticsOverviewDto());

    const { getAnalyticsOverview } = await import("./analytics.service");
    const result = await getAnalyticsOverview("workspace-1", {
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      description: "salary",
      accountIds: ["account-1"],
      categoryIds: ["category-1"],
      userIds: ["user-1"],
      transactionTypes: [PaymentTransactionType.INCOME],
      amountFrom: "10",
      amountTo: "500",
    });

    expect(getApiAnalyticsOverviewMock).toHaveBeenCalledWith(
      "workspace-1",
      {
        amountFrom: "10",
        amountTo: "500",
        userIds: ["user-1"],
        transactionTypes: [PaymentTransactionType.INCOME],
        categoryIds: ["category-1"],
        accountIds: ["account-1"],
        description: "salary",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      },
      requestOptions
    );
    expect(result).toEqual(
      expect.objectContaining({
        baseCurrency: "BYN",
        summary: expect.objectContaining({
          income: expect.objectContaining({ percentageChange: 50 }),
          expense: expect.objectContaining({ percentageChange: null }),
          netFlow: expect.objectContaining({ percentageChange: null }),
        }),
        largestMovements: [expect.objectContaining({ kind: "paymentTransaction" })],
      })
    );
  });

  it("omits empty filters and preserves the legacy overview shape", async () => {
    getApiAnalyticsOverviewMock.mockResolvedValue(
      createAnalyticsOverviewDto({
        largestMovements: [
          {
            id: "debt-transaction-1",
            kind: "debtTransaction",
            kindLabel: "Долг",
            date: "2026-04-02",
            primaryLabel: "Alex",
            secondaryLabel: "Погашение долга",
            originalAmount: "20 USD",
            amountInBaseCurrency: "60 BYN",
          },
        ],
      })
    );

    const { getAnalyticsOverview } = await import("./analytics.service");

    await expect(getAnalyticsOverview("workspace-1")).resolves.toEqual(
      expect.objectContaining({
        effectiveRange: expect.objectContaining({ dayCount: 30 }),
        timeSeries: [expect.objectContaining({ date: "2026-04-01" })],
        expenseCategories: [expect.objectContaining({ id: "category-1" })],
        debtsByPerson: [expect.objectContaining({ personName: "Alex" })],
        largestMovements: [expect.objectContaining({ kind: "debtTransaction" })],
      })
    );
    expect(getApiAnalyticsOverviewMock).toHaveBeenCalledWith("workspace-1", undefined, requestOptions);
  });

  it("normalizes API failures into the legacy error result", async () => {
    getApiAnalyticsOverviewMock.mockRejectedValue(new Error("No access"));

    const { getAnalyticsOverview } = await import("./analytics.service");

    await expect(getAnalyticsOverview("workspace-1")).resolves.toEqual({ error: "No access" });
  });
});
