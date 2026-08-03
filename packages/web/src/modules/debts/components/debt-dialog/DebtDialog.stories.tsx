import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import type { Account } from "@/modules/accounts/account.types";
import { CategoryType } from "@/modules/categories/category.constants";
import type { CategoryWithCount } from "@/modules/categories/category.types";
import { ok } from "@/shared/lib/action-result";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";

import { DebtStatus, DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";
import { DebtDialog } from "./DebtDialog";

const workspaceId = "workspace-family";
const now = new Date("2026-08-03T12:00:00.000Z");

const accounts = [
  {
    id: "account-main",
    workspaceId,
    ownerId: "user-nikita",
    name: "Основная карта",
    balance: "184520.45",
    initialBalance: "150000",
    currency: "RUB",
    description: null,
    color: "#2f6bff",
    icon: "credit-card",
    archived: false,
    hidden: false,
    order: 1,
    createdAt: now,
    updatedAt: now,
    owner: null,
  },
] satisfies Account[];

const categories = [
  {
    id: "category-income",
    workspaceId,
    name: "Возврат долга",
    type: CategoryType.INCOME,
    icon: "hand-coins",
    iconAssetId: null,
    order: 1,
    createdAt: now,
    updatedAt: now,
    _count: { paymentTransactions: 0 },
  },
  {
    id: "category-expense",
    workspaceId,
    name: "Погашение долга",
    type: CategoryType.EXPENSE,
    icon: "wallet-cards",
    iconAssetId: null,
    order: 2,
    createdAt: now,
    updatedAt: now,
    _count: { paymentTransactions: 0 },
  },
] satisfies CategoryWithCount[];

function createStoryQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });

  queryClient.setQueryData(accountKeys.list(workspaceId), ok(accounts));
  queryClient.setQueryData(categoryKeys.list(workspaceId), ok(categories));

  return queryClient;
}

function DebtDialogStory({ debt }: { debt: DebtWithRelations }) {
  const [open, setOpen] = useState(true);
  const [queryClient] = useState(createStoryQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-[560px] items-start justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6">
        <Button onClick={() => setOpen(true)} type="button">
          Открыть долг
        </Button>
        <DebtDialog debt={debt} workspaceId={workspaceId} open={open} onOpenChange={setOpen} />
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  title: "Finance/Debt Dialog",
  component: DebtDialog,
} satisfies Meta<typeof DebtDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const openLentDebt: DebtWithRelations = {
  id: "debt-lent",
  workspaceId,
  type: DebtType.LENT,
  personName: "Анна",
  amount: "25000",
  remainingAmount: "14500",
  currency: "RUB",
  date: now,
  status: DebtStatus.OPEN,
  createdAt: now,
  updatedAt: now,
};

const openBorrowedDebt: DebtWithRelations = {
  ...openLentDebt,
  id: "debt-borrowed",
  type: DebtType.BORROWED,
  personName: "Иван",
};

const closedDebt: DebtWithRelations = {
  ...openLentDebt,
  id: "debt-closed",
  personName: "Мария",
  remainingAmount: "0",
  status: DebtStatus.CLOSED,
};

export const OpenLent: Story = {
  args: {
    debt: openLentDebt,
    workspaceId,
    open: true,
    onOpenChange: () => {},
  },
  render: () => <DebtDialogStory debt={openLentDebt} />,
};

export const OpenBorrowed: Story = {
  args: {
    debt: openBorrowedDebt,
    workspaceId,
    open: true,
    onOpenChange: () => {},
  },
  render: () => <DebtDialogStory debt={openBorrowedDebt} />,
};

export const Closed: Story = {
  args: {
    debt: closedDebt,
    workspaceId,
    open: true,
    onOpenChange: () => {},
  },
  render: () => <DebtDialogStory debt={closedDebt} />,
};
