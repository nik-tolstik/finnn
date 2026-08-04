import type { Meta, StoryObj } from "@storybook/react-vite";

import { DebtStatus, DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";
import { DebtCard } from "./DebtCard";

const now = new Date("2026-08-03T12:00:00.000Z");

const baseClosedDebt: DebtWithRelations = {
  id: "debt-closed",
  workspaceId: "workspace-family",
  type: DebtType.LENT,
  personName: "Анна",
  amount: "25000",
  remainingAmount: "0",
  currency: "RUB",
  date: now,
  status: DebtStatus.CLOSED,
  createdAt: now,
  updatedAt: now,
};

const meta = {
  title: "Finance/Debt Card",
  component: DebtCard,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[min(100%,28rem)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DebtCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ClosedLent: Story = {
  args: {
    debt: baseClosedDebt,
    onClick: () => undefined,
  },
};

export const ClosedBorrowed: Story = {
  args: {
    debt: {
      ...baseClosedDebt,
      id: "debt-closed-borrowed",
      type: DebtType.BORROWED,
      personName: "Иван",
    },
    onClick: () => undefined,
  },
};

export const ClosedLongName: Story = {
  args: {
    debt: {
      ...baseClosedDebt,
      id: "debt-closed-long-name",
      personName: "Александра Константиновна Воронцова-Кузнецова",
      amount: "1250000.75",
    },
    onClick: () => undefined,
  },
};
