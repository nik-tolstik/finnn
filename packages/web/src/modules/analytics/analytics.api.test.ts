import { describe, expect, it } from "vitest";

import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import type { AnalyticsOverviewResponseDto } from "@/shared/api/generated/model";
import { AnalyticsLargestMovementDtoKind } from "@/shared/api/generated/model";

import { toAnalyticsErrorResult, toAnalyticsOverviewParams, toAnalyticsOverviewResult } from "./analytics.api";

function createAnalyticsOverviewDto(
  overrides: Partial<AnalyticsOverviewResponseDto> = {}
): AnalyticsOverviewResponseDto {
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
        kind: AnalyticsLargestMovementDtoKind.paymentTransaction,
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

describe("analytics API helpers", () => {
  it("maps frontend filters to API query params", () => {
    expect(
      toAnalyticsOverviewParams({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        description: "salary",
        accountIds: ["account-1"],
        categoryIds: ["category-1"],
        userIds: ["user-1"],
        transactionTypes: [PaymentTransactionType.INCOME],
        amountFrom: "10",
        amountTo: "500",
      })
    ).toEqual({
      amountFrom: "10",
      amountTo: "500",
      userIds: ["user-1"],
      transactionTypes: [PaymentTransactionType.INCOME],
      categoryIds: ["category-1"],
      accountIds: ["account-1"],
      description: "salary",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });
  });

  it("omits empty filters", () => {
    expect(toAnalyticsOverviewParams()).toBeUndefined();
    expect(toAnalyticsOverviewParams({})).toBeUndefined();
  });

  it("normalizes optional percentage changes and preserves overview arrays", () => {
    expect(toAnalyticsOverviewResult(createAnalyticsOverviewDto())).toEqual(
      expect.objectContaining({
        baseCurrency: "BYN",
        summary: expect.objectContaining({
          income: expect.objectContaining({ percentageChange: 50 }),
          expense: expect.objectContaining({ percentageChange: null }),
          netFlow: expect.objectContaining({ percentageChange: null }),
        }),
        timeSeries: [expect.objectContaining({ date: "2026-04-01" })],
        expenseCategories: [expect.objectContaining({ id: "category-1" })],
        debtsByPerson: [expect.objectContaining({ personName: "Alex" })],
        largestMovements: [expect.objectContaining({ kind: "paymentTransaction" })],
      })
    );
  });

  it("normalizes API failures into the UI-facing error result", () => {
    expect(toAnalyticsErrorResult(new Error("No access"))).toEqual({ error: "No access" });
  });
});
