import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryType } from "@/modules/categories/category.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

import { DebtStatus, DebtTransactionType, DebtType } from "./debt.constants";

const transactionMock = vi.fn();
const requireUserIdMock = vi.fn();
const revalidateDebtRoutesMock = vi.fn();

vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

vi.mock("@/shared/lib/server-access", () => ({
  requireUserId: requireUserIdMock,
  requireWorkspaceAccess: vi.fn(),
}));

vi.mock("@/shared/lib/revalidate-app-routes", () => ({
  revalidateDebtRoutes: revalidateDebtRoutesMock,
}));

type DebtFixture = {
  id: string;
  workspaceId: string;
  type: DebtType;
  personName: string;
  amount: string;
  remainingAmount: string;
  currency: string;
  accountId: string | null;
  date: Date;
  status: DebtStatus;
  createdAt: Date;
  updatedAt: Date;
  account: null;
};

function createDebt(overrides: Partial<DebtFixture> = {}): DebtFixture {
  return {
    id: "debt-1",
    workspaceId: "workspace-1",
    type: DebtType.LENT,
    personName: "Alex",
    amount: "95",
    remainingAmount: "95",
    currency: "USD",
    accountId: "account-1",
    date: new Date("2026-04-01T00:00:00.000Z"),
    status: DebtStatus.OPEN,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    account: null,
    ...overrides,
  };
}

function createAccount(
  overrides: Partial<{ id: string; workspaceId: string; balance: string; currency: string }> = {}
) {
  return {
    id: "account-1",
    workspaceId: "workspace-1",
    balance: "100",
    currency: "USD",
    name: "USD Wallet",
    ...overrides,
  };
}

type TxMock = {
  debt: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  account: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  category: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  debtTransaction: {
    create: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTxMock({
  debt = createDebt(),
  account = createAccount(),
  category,
}: {
  debt?: DebtFixture;
  account?: ReturnType<typeof createAccount>;
  category?: { id: string; type: CategoryType; name: string } | null;
} = {}) {
  const tx: TxMock = {
    debt: {
      findFirst: vi.fn().mockResolvedValue(debt),
      update: vi.fn().mockResolvedValue({ ...debt, remainingAmount: "0", status: DebtStatus.CLOSED }),
    },
    account: {
      findFirst: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue(account),
    },
    category: {
      findFirst: vi.fn().mockResolvedValue(category),
      create: vi.fn().mockResolvedValue({ id: "gift-category-created", name: "Подарки", type: CategoryType.INCOME }),
    },
    debtTransaction: {
      create: vi.fn().mockResolvedValue({ id: "debt-transaction-1" }),
    },
    paymentTransaction: {
      create: vi.fn().mockResolvedValue({ id: "gift-transaction-1" }),
    },
  };

  transactionMock.mockImplementation(async (callback: (tx: TxMock) => unknown) => callback(tx));

  return tx;
}

describe("closeDebt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserIdMock.mockResolvedValue("user-1");
  });

  it("closes a lent debt at the remaining amount and records the overpayment as income in the selected category", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.LENT, remainingAmount: "95" }),
      account: createAccount({ balance: "100", currency: "USD" }),
      category: { id: "category-income", name: "Подарки", type: CategoryType.INCOME },
    });

    const result = await closeDebt("debt-1", {
      amount: "95",
      paymentAmount: "100",
      categoryId: "category-income",
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ data: expect.objectContaining({ status: DebtStatus.CLOSED }) });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { balance: "200" },
    });
    expect(tx.debtTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: DebtTransactionType.CLOSED,
        amount: "95",
      }),
    });
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        accountId: "account-1",
        amount: "5",
        type: PaymentTransactionType.INCOME,
        categoryId: "category-income",
      }),
    });
    expect(tx.category.create).not.toHaveBeenCalled();
    expect(revalidateDebtRoutesMock).toHaveBeenCalledTimes(1);
  });

  it("closes a borrowed debt at the remaining amount and records the overpayment as expense in the selected category", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.BORROWED, remainingAmount: "95" }),
      account: createAccount({ balance: "150", currency: "USD" }),
      category: { id: "category-expense", name: "Подарки", type: CategoryType.EXPENSE },
    });

    const result = await closeDebt("debt-1", {
      amount: "95",
      paymentAmount: "100",
      categoryId: "category-expense",
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ data: expect.objectContaining({ status: DebtStatus.CLOSED }) });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { balance: "50" },
    });
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: "5",
        type: PaymentTransactionType.EXPENSE,
        categoryId: "category-expense",
      }),
    });
  });

  it("closes a lent debt early and records the unpaid remainder as expense in the selected category", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.LENT, remainingAmount: "100" }),
      account: createAccount({ balance: "100", currency: "USD" }),
      category: { id: "category-expense", name: "Прощено", type: CategoryType.EXPENSE },
    });

    const result = await closeDebt("debt-1", {
      amount: "50",
      paymentAmount: "50",
      categoryId: "category-expense",
      closeEarly: true,
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ data: expect.objectContaining({ status: DebtStatus.CLOSED }) });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { balance: "150" },
    });
    expect(tx.debtTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: DebtTransactionType.CLOSED,
        amount: "100",
      }),
    });
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        accountId: "account-1",
        amount: "50",
        type: PaymentTransactionType.EXPENSE,
        categoryId: "category-expense",
      }),
    });
  });

  it("closes a borrowed debt early and records the unpaid remainder as income in the selected category", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.BORROWED, remainingAmount: "100" }),
      account: createAccount({ balance: "100", currency: "USD" }),
      category: { id: "category-income", name: "Списано", type: CategoryType.INCOME },
    });

    const result = await closeDebt("debt-1", {
      amount: "50",
      paymentAmount: "50",
      categoryId: "category-income",
      closeEarly: true,
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ data: expect.objectContaining({ status: DebtStatus.CLOSED }) });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { balance: "50" },
    });
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: "50",
        type: PaymentTransactionType.INCOME,
        categoryId: "category-income",
      }),
    });
  });

  it("requires a selected category when close creates a category transaction", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.LENT, remainingAmount: "95" }),
      account: createAccount({ balance: "100", currency: "USD" }),
    });

    const result = await closeDebt("debt-1", {
      amount: "95",
      paymentAmount: "100",
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ error: "Выберите категорию" });
    expect(tx.debt.update).not.toHaveBeenCalled();
    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects a category that does not belong to the workspace or expected type", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.LENT, remainingAmount: "95" }),
      account: createAccount({ balance: "100", currency: "USD" }),
      category: null,
    });

    const result = await closeDebt("debt-1", {
      amount: "95",
      paymentAmount: "100",
      categoryId: "category-wrong",
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ error: "Категория не найдена или не подходит для этой операции" });
    expect(tx.debt.update).not.toHaveBeenCalled();
    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects overpayment when the selected account currency differs from the debt currency", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.LENT, remainingAmount: "95", currency: "USD" }),
      account: createAccount({ balance: "100", currency: "EUR" }),
    });

    const result = await closeDebt("debt-1", {
      amount: "95",
      paymentAmount: "100",
      categoryId: "category-income",
      toAmount: "90",
      accountId: "account-1",
      useAccount: true,
    });

    expect(result).toEqual({ error: "Подарок при закрытии долга доступен только в валюте долга" });
    expect(tx.debt.update).not.toHaveBeenCalled();
    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("keeps the existing close behavior when no overpayment is provided", async () => {
    const { closeDebt } = await import("./debt.service");
    const tx = createTxMock({
      debt: createDebt({ type: DebtType.LENT, remainingAmount: "95" }),
      account: createAccount({ balance: "100", currency: "USD" }),
    });

    await closeDebt("debt-1", {
      amount: "50",
      accountId: "account-1",
      useAccount: true,
    });

    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { balance: "150" },
    });
    expect(tx.debt.update).toHaveBeenCalledWith({
      where: { id: "debt-1" },
      data: {
        remainingAmount: "45",
        status: DebtStatus.OPEN,
      },
    });
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });
});
