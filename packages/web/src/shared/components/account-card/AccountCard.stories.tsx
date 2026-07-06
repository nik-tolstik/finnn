import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Account } from "@/modules/accounts/account.types";
import { AccountCardSkeleton } from "@/shared/components/AccountCardSkeleton";
import { AccountChip } from "@/shared/components/AccountChip";

import { AccountCard } from "./AccountCard";

const now = new Date("2026-07-06T12:00:00.000Z");

const accounts = [
  {
    id: "account-main-card",
    workspaceId: "workspace-family",
    ownerId: "user-nikita",
    name: "Основная карта",
    balance: "184520.45",
    initialBalance: "150000",
    currency: "RUB",
    description: "Daily spending",
    color: "#2f6bff",
    icon: "credit-card",
    archived: false,
    order: 1,
    createdAt: now,
    updatedAt: now,
    owner: {
      id: "user-nikita",
      name: "Никита",
      email: "nikita@example.com",
      image: null,
    },
  },
  {
    id: "account-shared-cash",
    workspaceId: "workspace-family",
    ownerId: null,
    name: "Общие наличные",
    balance: "980.5",
    initialBalance: "500",
    currency: "USD",
    description: null,
    color: "#16a34a",
    icon: "wallet",
    archived: false,
    order: 2,
    createdAt: now,
    updatedAt: now,
    owner: null,
  },
  {
    id: "account-savings",
    workspaceId: "workspace-family",
    ownerId: "user-anna",
    name: "Накопления",
    balance: "4250",
    initialBalance: "4000",
    currency: "EUR",
    description: null,
    color: "#8b5cf6",
    icon: "piggy-bank",
    archived: false,
    order: 3,
    createdAt: now,
    updatedAt: now,
    owner: {
      id: "user-anna",
      name: "Анна",
      email: "anna@example.com",
      image: null,
    },
  },
] satisfies Account[];

const meta = {
  title: "Finance/Account Card",
  component: AccountCard,
  args: {
    account: accounts[0],
  },
  decorators: [
    (Story) => (
      <div className="grid max-w-3xl gap-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutOwner: Story = {
  args: {
    account: accounts[1],
    showOwner: false,
  },
};

export const AccountSet: Story = {
  render: () => (
    <div className="grid gap-3">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  ),
};

export const CompactChips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {accounts.map((account) => (
        <AccountChip key={account.id} account={account} />
      ))}
    </div>
  ),
};

export const LoadingState: Story = {
  render: () => (
    <div className="grid gap-3">
      <AccountCardSkeleton />
      <AccountCardSkeleton />
      <AccountCardSkeleton />
    </div>
  ),
};
