import { describe, expect, it, vi } from "vitest";

import type { AnalyticsOverviewResult } from "./analytics.types";
import {
  applyAnalyticsPeriodPreset,
  buildAnalyticsOverviewViewModel,
  getActiveAnalyticsPeriodPreset,
  getAnalyticsPeriodPresetRange,
  getAnalyticsTrendTone,
  selectAnalyticsCapitalTicks,
} from "./analytics.view-model";

function createAnalytics(overrides: Partial<AnalyticsOverviewResult> = {}): AnalyticsOverviewResult {
  return {
    baseCurrency: "BYN",
    effectiveRange: {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      previousStartDate: "2026-03-29",
      previousEndDate: "2026-03-31",
      dayCount: 3,
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
        previousTotalInBaseCurrency: "150",
        percentageChange: -20,
        transactionCount: 3,
      },
      netFlow: {
        totalInBaseCurrency: "180",
        previousTotalInBaseCurrency: "50",
        percentageChange: 260,
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
      expensePreviousTotalInBaseCurrency: "150",
      netFlowPreviousTotalInBaseCurrency: "50",
    },
    timeSeries: [
      {
        date: "2026-04-01",
        incomeTotalInBaseCurrency: "100",
        expenseTotalInBaseCurrency: "20",
      },
      {
        date: "2026-04-02",
        incomeTotalInBaseCurrency: "0",
        expenseTotalInBaseCurrency: "80",
      },
      {
        date: "2026-04-03",
        incomeTotalInBaseCurrency: "200",
        expenseTotalInBaseCurrency: "20",
      },
    ],
    capitalTimeSeries: [
      {
        date: "2026-04-01",
        totalInBaseCurrency: "100",
      },
      {
        date: "2026-04-02",
        totalInBaseCurrency: "92",
      },
      {
        date: "2026-04-03",
        totalInBaseCurrency: "110",
      },
    ],
    incomeCategories: [
      {
        id: "salary",
        name: "Зарплата",
        totalInBaseCurrency: "300",
        transactionCount: 2,
        sharePercent: 100,
      },
    ],
    expenseCategories: [
      {
        id: "food",
        name: "Еда",
        totalInBaseCurrency: "80",
        transactionCount: 2,
        sharePercent: 66.7,
      },
      {
        id: "transport",
        name: "Транспорт",
        totalInBaseCurrency: "40",
        transactionCount: 1,
        sharePercent: 33.3,
      },
    ],
    debtsByPerson: [
      {
        personName: "Alex",
        lentTotalInBaseCurrency: "120",
        borrowedTotalInBaseCurrency: "30",
        netExposureInBaseCurrency: "90",
        debtCount: 2,
      },
    ],
    largestMovements: [],
    ...overrides,
  };
}

describe("analytics view model", () => {
  it("calculates saving rate when income is positive", () => {
    const viewModel = buildAnalyticsOverviewViewModel(createAnalytics());

    expect(viewModel.savingRatePercent).toBe(60);
    expect(viewModel.savingRateLabel).toBe("+60.0%");
    expect(viewModel.savingRateTone).toBe("positive");
  });

  it("handles saving rate without income", () => {
    const viewModel = buildAnalyticsOverviewViewModel(
      createAnalytics({
        summary: {
          ...createAnalytics().summary,
          income: {
            totalInBaseCurrency: "0",
            previousTotalInBaseCurrency: "0",
            percentageChange: 0,
            transactionCount: 0,
          },
          netFlow: {
            totalInBaseCurrency: "-120",
            previousTotalInBaseCurrency: "0",
            percentageChange: null,
          },
        },
      })
    );

    expect(viewModel.savingRatePercent).toBeNull();
    expect(viewModel.savingRateLabel).toBe("Нет доходов");
    expect(viewModel.savingRateTone).toBe("neutral");
  });

  it("builds cumulative net flow points", () => {
    const viewModel = buildAnalyticsOverviewViewModel(createAnalytics());

    expect(viewModel.timeSeries.map((point) => point.cumulativeNetFlow)).toEqual([80, 0, 180]);
  });

  it("builds formatted capital time series points", () => {
    const viewModel = buildAnalyticsOverviewViewModel(createAnalytics());

    expect(viewModel.capitalTimeSeries).toEqual([
      {
        date: "2026-04-01",
        total: 100,
        totalLabel: "100.00 Br",
      },
      {
        date: "2026-04-02",
        total: 92,
        totalLabel: "92.00 Br",
      },
      {
        date: "2026-04-03",
        total: 110,
        totalLabel: "110.00 Br",
      },
    ]);
  });

  it("exposes top category and average daily metrics", () => {
    const viewModel = buildAnalyticsOverviewViewModel(createAnalytics());

    expect(viewModel.incomeCategoryRows[0]).toMatchObject({
      id: "salary",
      sharePercent: 100,
      transactionCount: 2,
    });
    expect(viewModel.topExpenseCategory).toMatchObject({
      id: "food",
      sharePercent: 66.7,
      transactionCount: 2,
    });
    expect(viewModel.averageIncomePerDayLabel).toBe("100.00 Br");
    expect(viewModel.averageExpensePerDayLabel).toBe("40.00 Br");
  });

  it("assigns trend tones by favorable direction", () => {
    expect(getAnalyticsTrendTone(10, "up")).toBe("positive");
    expect(getAnalyticsTrendTone(-10, "up")).toBe("negative");
    expect(getAnalyticsTrendTone(-10, "down")).toBe("positive");
    expect(getAnalyticsTrendTone(10, "down")).toBe("negative");
    expect(getAnalyticsTrendTone(0, "up")).toBe("neutral");
    expect(getAnalyticsTrendTone(null, "up")).toBe("neutral");
  });
});

describe("analytics capital chart ticks", () => {
  const points = Array.from({ length: 10 }, (_, index) => ({
    date: `2026-04-${String(index + 1).padStart(2, "0")}`,
    total: index,
    totalLabel: String(index),
  }));

  it("keeps all dates when the series fits the max tick count", () => {
    expect(selectAnalyticsCapitalTicks(points.slice(0, 4), 4)).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
    ]);
  });

  it("limits ticks while preserving first and last dates", () => {
    const ticks = selectAnalyticsCapitalTicks(points, 4);

    expect(ticks).toHaveLength(4);
    expect(ticks[0]).toBe("2026-04-01");
    expect(ticks.at(-1)).toBe("2026-04-10");
  });
});

describe("analytics period presets", () => {
  it("calculates relative day presets", () => {
    const referenceDate = new Date("2026-04-05T12:00:00.000Z");

    expect(getAnalyticsPeriodPresetRange("7d", referenceDate)).toEqual({
      dateFrom: "2026-03-30",
      dateTo: "2026-04-05",
    });
    expect(getAnalyticsPeriodPresetRange("30d", referenceDate)).toEqual({
      dateFrom: "2026-03-07",
      dateTo: "2026-04-05",
    });
    expect(getAnalyticsPeriodPresetRange("90d", referenceDate)).toEqual({
      dateFrom: "2026-01-06",
      dateTo: "2026-04-05",
    });
  });

  it("calculates month presets", () => {
    const referenceDate = new Date("2026-04-05T12:00:00.000Z");

    expect(getAnalyticsPeriodPresetRange("thisMonth", referenceDate)).toEqual({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-05",
    });
    expect(getAnalyticsPeriodPresetRange("previousMonth", referenceDate)).toEqual({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
    });
  });

  it("preserves other filters when applying a period preset", () => {
    const referenceDate = new Date("2026-04-05T12:00:00.000Z");

    expect(
      applyAnalyticsPeriodPreset(
        {
          accountIds: ["account-1"],
          categoryIds: ["category-1"],
          description: "coffee",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
        },
        "7d",
        referenceDate
      )
    ).toEqual({
      accountIds: ["account-1"],
      categoryIds: ["category-1"],
      description: "coffee",
      dateFrom: "2026-03-30",
      dateTo: "2026-04-05",
    });
  });

  it("detects the active preset from an effective range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00.000Z"));

    expect(getActiveAnalyticsPeriodPreset({ dateFrom: "2026-03-07", dateTo: "2026-04-05" })).toBe("30d");
    expect(getActiveAnalyticsPeriodPreset({ dateFrom: "2026-03-10", dateTo: "2026-04-05" })).toBeNull();

    vi.useRealTimers();
  });
});
