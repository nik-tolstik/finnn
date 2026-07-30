import type { Meta, StoryObj } from "@storybook/react-vite";

import type { AnalyticsOverviewViewModel } from "@/modules/analytics/analytics.view-model";

import { AnalyticsCharts } from "./AnalyticsCharts";

const viewModel = {
  savingRatePercent: 36.4,
  savingRateLabel: "36.4%",
  savingRateTone: "positive",
  averageIncomePerDayLabel: "8 720 ₽",
  averageExpensePerDayLabel: "5 548 ₽",
  incomeTone: "positive",
  expenseTone: "neutral",
  netFlowTone: "positive",
  incomeDeltaLabel: "+18.2% к прошлому периоду",
  expenseDeltaLabel: "+4.5% к прошлому периоду",
  netFlowDeltaLabel: "+42.1% к прошлому периоду",
  topExpenseCategory: {
    id: "category-grocery",
    name: "Продукты",
    total: "93400",
    totalLabel: "93 400 ₽",
    transactionCount: 38,
    sharePercent: 34.7,
    barWidthPercent: 100,
  },
  timeSeries: [],
  capitalTimeSeries: [
    { date: "2026-06-01", total: 840000, totalLabel: "840 000 ₽" },
    { date: "2026-06-06", total: 861500, totalLabel: "861 500 ₽" },
    { date: "2026-06-11", total: 875200, totalLabel: "875 200 ₽" },
    { date: "2026-06-16", total: 892400, totalLabel: "892 400 ₽" },
    { date: "2026-06-21", total: 884900, totalLabel: "884 900 ₽" },
    { date: "2026-06-26", total: 913600, totalLabel: "913 600 ₽" },
    { date: "2026-06-30", total: 928450, totalLabel: "928 450 ₽" },
  ],
  incomeCategoryRows: [
    {
      id: "income-salary",
      name: "Зарплата",
      total: "245000",
      totalLabel: "245 000 ₽",
      transactionCount: 1,
      sharePercent: 72.1,
      barWidthPercent: 100,
    },
    {
      id: "income-side-project",
      name: "Проекты",
      total: "74000",
      totalLabel: "74 000 ₽",
      transactionCount: 3,
      sharePercent: 21.8,
      barWidthPercent: 30.2,
    },
    {
      id: "income-cashback",
      name: "Кэшбек",
      total: "20800",
      totalLabel: "20 800 ₽",
      transactionCount: 9,
      sharePercent: 6.1,
      barWidthPercent: 8.5,
    },
  ],
  categoryRows: [
    {
      id: "expense-grocery",
      name: "Продукты",
      total: "93400",
      totalLabel: "93 400 ₽",
      transactionCount: 38,
      sharePercent: 34.7,
      barWidthPercent: 100,
    },
    {
      id: "expense-rent",
      name: "Аренда",
      total: "82000",
      totalLabel: "82 000 ₽",
      transactionCount: 1,
      sharePercent: 30.5,
      barWidthPercent: 87.8,
    },
    {
      id: "expense-transport",
      name: "Транспорт",
      total: "28100",
      totalLabel: "28 100 ₽",
      transactionCount: 18,
      sharePercent: 10.4,
      barWidthPercent: 30.1,
    },
    {
      id: "expense-health",
      name: "Здоровье",
      total: "21600",
      totalLabel: "21 600 ₽",
      transactionCount: 5,
      sharePercent: 8,
      barWidthPercent: 23.1,
    },
  ],
  debtRows: [],
} satisfies AnalyticsOverviewViewModel;

const meta = {
  title: "Analytics/Charts",
  component: AnalyticsCharts,
  args: {
    viewModel,
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnalyticsCharts>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Empty: Story = {
  args: {
    viewModel: {
      ...viewModel,
      capitalTimeSeries: [],
      incomeCategoryRows: [],
      categoryRows: [],
    },
  },
};
