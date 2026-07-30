import type { Meta, StoryObj } from "@storybook/react-vite";

import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import type {
  PaymentTransactionWithRelations,
  TransactionAccountWithOwner,
  TransactionUser,
  TransferTransactionWithRelations,
} from "@/modules/transactions/transaction.types";

import { RegularTransactionItem } from "./components/RegularTransactionItem";
import { TransferTransactionItem } from "./components/TransferTransactionItem";

const now = new Date("2026-07-06T12:00:00.000Z");

const owner = {
  id: "user-nikita",
  name: "Никита",
  email: "nikita@example.com",
  image: null,
} satisfies TransactionUser;

const checkingAccount = {
  id: "account-main-card",
  name: "Основная карта",
  currency: "RUB",
  color: "#2f6bff",
  icon: "credit-card",
  ownerId: owner.id,
  owner,
} satisfies TransactionAccountWithOwner;

const savingsAccount = {
  id: "account-savings",
  name: "Накопления",
  currency: "EUR",
  color: "#8b5cf6",
  icon: "piggy-bank",
  ownerId: owner.id,
  owner,
} satisfies TransactionAccountWithOwner;

const incomeTransaction = {
  id: "transaction-income",
  workspaceId: "workspace-family",
  accountId: checkingAccount.id,
  amount: "245000",
  type: PaymentTransactionType.INCOME,
  description: "Июльский платеж по проекту",
  date: now,
  categoryId: "category-salary",
  createdByAi: false,
  createdAt: now,
  updatedAt: now,
  account: checkingAccount,
  category: {
    id: "category-salary",
    name: "Зарплата",
  },
  debtWriteOff: null,
} satisfies PaymentTransactionWithRelations;

const expenseTransaction = {
  ...incomeTransaction,
  id: "transaction-expense",
  amount: "8420.25",
  type: PaymentTransactionType.EXPENSE,
  description: "Продукты и бытовые мелочи",
  categoryId: "category-grocery",
  createdByAi: true,
  category: {
    id: "category-grocery",
    name: "Супермаркет",
  },
} satisfies PaymentTransactionWithRelations;

const transferTransaction = {
  id: "transfer-savings",
  workspaceId: "workspace-family",
  fromAccountId: checkingAccount.id,
  toAccountId: savingsAccount.id,
  createdById: owner.id,
  amount: "50000",
  toAmount: "500",
  description: "Ежемесячное пополнение накоплений",
  date: now,
  createdByAi: true,
  createdAt: now,
  updatedAt: now,
  fromAccount: checkingAccount,
  toAccount: savingsAccount,
  createdBy: owner,
} satisfies TransferTransactionWithRelations;

const meta = {
  title: "Finance/Transaction Items",
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto grid max-w-3xl gap-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const RegularIncome: Story = {
  render: () => <RegularTransactionItem transaction={incomeTransaction} workspaceName="Семья" onClick={() => {}} />,
};

export const RegularExpenseAi: Story = {
  render: () => <RegularTransactionItem transaction={expenseTransaction} workspaceName="Семья" onClick={() => {}} />,
};

export const Transfer: Story = {
  render: () => <TransferTransactionItem transaction={transferTransaction} onClick={() => {}} />,
};

export const TransactionSet: Story = {
  render: () => (
    <div className="grid gap-3">
      <RegularTransactionItem transaction={incomeTransaction} workspaceName="Семья" onClick={() => {}} />
      <RegularTransactionItem transaction={expenseTransaction} workspaceName="Семья" onClick={() => {}} />
      <TransferTransactionItem transaction={transferTransaction} onClick={() => {}} />
    </div>
  ),
};
