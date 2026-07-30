import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import type { Account } from "@/modules/accounts/account.types";
import { CategoryType } from "@/modules/categories/category.constants";
import type { CategoryWithCount } from "@/modules/categories/category.types";
import { CreateDebtDialog } from "@/modules/debts/components/create-debt-dialog";
import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { TRANSFER_TRANSACTION_MODE } from "@/modules/transactions/components/create-transaction-dialog/create-transaction-dialog.utils";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { ok } from "@/shared/lib/action-result";
import { ApiSessionProvider, apiSessionQueryKey } from "@/shared/lib/api-session-client";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import type { CreateDebtInput } from "@/shared/lib/validations/debt";
import type {
  CreatePaymentTransactionInput,
  CreateTransferTransactionInput,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";

const workspaceId = "workspace-family";
const now = new Date("2026-07-06T12:00:00.000Z");

const currentUser = {
  id: "user-nikita",
  name: "Никита",
  email: "nikita@example.com",
  image: null,
  emailVerified: "2026-07-01T09:00:00.000Z",
  telegram: {
    linked: false,
    username: null,
    displayName: null,
    photoUrl: null,
  },
  google: {
    linked: false,
    email: null,
    displayName: null,
    photoUrl: null,
  },
};

const accounts = [
  {
    id: "account-main-card",
    workspaceId,
    ownerId: currentUser.id,
    name: "Основная карта",
    balance: "184520.45",
    initialBalance: "150000",
    currency: "RUB",
    description: "Daily spending",
    color: "#2f6bff",
    icon: "credit-card",
    archived: false,
    hidden: false,
    order: 1,
    createdAt: now,
    updatedAt: now,
    owner: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      image: currentUser.image,
    },
  },
  {
    id: "account-shared-cash",
    workspaceId,
    ownerId: null,
    name: "Общие наличные",
    balance: "980.50",
    initialBalance: "500",
    currency: "USD",
    description: null,
    color: "#16a34a",
    icon: "wallet",
    archived: false,
    hidden: false,
    order: 2,
    createdAt: now,
    updatedAt: now,
    owner: null,
  },
  {
    id: "account-savings",
    workspaceId,
    ownerId: currentUser.id,
    name: "Накопления",
    balance: "4250",
    initialBalance: "4000",
    currency: "EUR",
    description: null,
    color: "#8b5cf6",
    icon: "piggy-bank",
    archived: false,
    hidden: false,
    order: 3,
    createdAt: now,
    updatedAt: now,
    owner: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      image: currentUser.image,
    },
  },
] satisfies Account[];

const categories = [
  {
    id: "category-grocery",
    workspaceId,
    name: "Супермаркет",
    type: CategoryType.EXPENSE,
    icon: "shopping-cart",
    iconAssetId: null,
    order: 1,
    createdAt: now,
    updatedAt: now,
    _count: {
      paymentTransactions: 12,
    },
  },
  {
    id: "category-transport",
    workspaceId,
    name: "Транспорт",
    type: CategoryType.EXPENSE,
    icon: "car",
    iconAssetId: null,
    order: 2,
    createdAt: now,
    updatedAt: now,
    _count: {
      paymentTransactions: 8,
    },
  },
  {
    id: "category-salary",
    workspaceId,
    name: "Зарплата",
    type: CategoryType.INCOME,
    icon: "briefcase-business",
    iconAssetId: null,
    order: 3,
    createdAt: now,
    updatedAt: now,
    _count: {
      paymentTransactions: 4,
    },
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

  queryClient.setQueryData(apiSessionQueryKey, {
    authenticated: true,
    user: currentUser,
  });
  queryClient.setQueryData(accountKeys.list(workspaceId), ok(accounts));
  queryClient.setQueryData(categoryKeys.list(workspaceId), ok(categories));

  return queryClient;
}

function FinanceStoryProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createStoryQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiSessionProvider>{children}</ApiSessionProvider>
    </QueryClientProvider>
  );
}

function ModalStoryFrame({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  return (
    <div className="flex min-h-[520px] items-start justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6">
      <Button type="button" onClick={onOpen}>
        Открыть модалку
      </Button>
      {children}
    </div>
  );
}

function TransactionDialogStory({
  defaultType = PaymentTransactionType.EXPENSE,
  initialAmount = "8420",
  initialDescription = "Продукты и бытовые мелочи",
  initialCategoryId = "category-grocery",
}: {
  defaultType?: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
  initialAmount?: string;
  initialDescription?: string;
  initialCategoryId?: string;
}) {
  const [open, setOpen] = useState(true);

  const handlePaymentSubmit = async (_input: CreatePaymentTransactionInput) => {};
  const handleTransferSubmit = async (_input: CreateTransferTransactionInput) => {};

  return (
    <FinanceStoryProviders>
      <ModalStoryFrame onOpen={() => setOpen(true)}>
        <CreateTransactionDialog
          workspaceId={workspaceId}
          account={accounts[0]}
          open={open}
          onOpenChange={setOpen}
          defaultType={defaultType}
          initialAmount={initialAmount}
          initialDescription={initialDescription}
          initialDate={now}
          initialCategoryId={initialCategoryId}
          onPaymentSubmit={handlePaymentSubmit}
          onTransferSubmit={handleTransferSubmit}
        />
      </ModalStoryFrame>
    </FinanceStoryProviders>
  );
}

function TransferDialogStory() {
  const [open, setOpen] = useState(true);
  const handlePaymentSubmit = async (_input: CreatePaymentTransactionInput) => {};
  const handleTransferSubmit = async (_input: CreateTransferTransactionInput) => {};

  return (
    <FinanceStoryProviders>
      <ModalStoryFrame onOpen={() => setOpen(true)}>
        <CreateTransactionDialog
          workspaceId={workspaceId}
          account={accounts[0]}
          open={open}
          onOpenChange={setOpen}
          defaultMode={TRANSFER_TRANSACTION_MODE}
          initialDate={now}
          onPaymentSubmit={handlePaymentSubmit}
          onTransferSubmit={handleTransferSubmit}
        />
      </ModalStoryFrame>
    </FinanceStoryProviders>
  );
}

function DebtDialogStory() {
  const [open, setOpen] = useState(true);
  const handleDebtSubmit = async (_input: CreateDebtInput) => {};

  return (
    <FinanceStoryProviders>
      <ModalStoryFrame onOpen={() => setOpen(true)}>
        <CreateDebtDialog
          workspaceId={workspaceId}
          open={open}
          onOpenChange={setOpen}
          onDebtSubmit={handleDebtSubmit}
        />
      </ModalStoryFrame>
    </FinanceStoryProviders>
  );
}

const meta = {
  title: "Finance/Create Modals",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExpenseTransaction: Story = {
  render: () => <TransactionDialogStory />,
};

export const IncomeTransaction: Story = {
  render: () => (
    <TransactionDialogStory
      defaultType={PaymentTransactionType.INCOME}
      initialAmount="245000"
      initialDescription="Июльский платеж по проекту"
      initialCategoryId="category-salary"
    />
  ),
};

export const TransferTransaction: Story = {
  render: () => <TransferDialogStory />,
};

export const Debt: Story = {
  render: () => <DebtDialogStory />,
};
