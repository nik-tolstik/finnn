import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEBT_TRANSACTION_FILTER_VALUE,
  PaymentTransactionType,
  TRANSFER_TRANSACTION_FILTER_VALUE,
} from "./transaction.constants";

const paymentFindManyMock = vi.fn();
const paymentCountMock = vi.fn();
const transferFindManyMock = vi.fn();
const transferCountMock = vi.fn();
const debtTransactionFindManyMock = vi.fn();
const debtTransactionCountMock = vi.fn();
const requireWorkspaceAccessMock = vi.fn();

vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    paymentTransaction: {
      findMany: paymentFindManyMock,
      count: paymentCountMock,
    },
    transferTransaction: {
      findMany: transferFindManyMock,
      count: transferCountMock,
    },
    debtTransaction: {
      findMany: debtTransactionFindManyMock,
      count: debtTransactionCountMock,
    },
  },
}));

vi.mock("@/shared/lib/server-access", () => ({
  requireUserId: vi.fn(),
  requireWorkspaceAccess: requireWorkspaceAccessMock,
}));

function createAccount(id: string, ownerId = "user-1") {
  return {
    id,
    name: id,
    currency: "USD",
    color: null,
    icon: null,
    ownerId,
    owner: {
      id: ownerId,
      name: ownerId,
      email: `${ownerId}@example.com`,
      image: null,
    },
  };
}

function createPaymentTransaction(id: string, amount: string, date = "2026-04-01T00:00:00.000Z") {
  return {
    id,
    workspaceId: "workspace-1",
    accountId: "account-1",
    amount,
    type: PaymentTransactionType.EXPENSE,
    description: "Groceries",
    date: new Date(date),
    categoryId: "category-1",
    createdAt: new Date(date),
    updatedAt: new Date(date),
    account: createAccount("account-1"),
    category: {
      id: "category-1",
      name: "Food",
    },
  };
}

function createTransferTransaction(id: string, amount: string, toAmount: string, date = "2026-04-02T00:00:00.000Z") {
  return {
    id,
    workspaceId: "workspace-1",
    fromAccountId: "account-1",
    toAccountId: "account-2",
    createdById: "user-1",
    amount,
    toAmount,
    description: "Transfer",
    date: new Date(date),
    createdAt: new Date(date),
    updatedAt: new Date(date),
    fromAccount: createAccount("account-1"),
    toAccount: createAccount("account-2", "user-2"),
    createdBy: {
      id: "user-1",
      name: "User",
      email: "user@example.com",
      image: null,
    },
  };
}

function createDebtTransaction(id: string, amount: string, date = "2026-04-03T00:00:00.000Z") {
  return {
    id,
    workspaceId: "workspace-1",
    debtId: "debt-1",
    accountId: "account-1",
    type: "created",
    amount,
    toAmount: null,
    date: new Date(date),
    createdAt: new Date(date),
    debt: {
      id: "debt-1",
      workspaceId: "workspace-1",
      type: "lent",
      personName: "Alex",
      amount,
      remainingAmount: amount,
      currency: "USD",
      accountId: "account-1",
      date: new Date(date),
      status: "open",
      createdAt: new Date(date),
      updatedAt: new Date(date),
    },
    account: createAccount("account-1"),
  };
}

describe("getCombinedTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceAccessMock.mockResolvedValue({ userId: "user-1" });
    paymentFindManyMock.mockResolvedValue([]);
    transferFindManyMock.mockResolvedValue([]);
    debtTransactionFindManyMock.mockResolvedValue([]);
    paymentCountMock.mockResolvedValue(0);
    transferCountMock.mockResolvedValue(0);
    debtTransactionCountMock.mockResolvedValue(0);
  });

  it("pushes payment filters and pagination limits into Prisma when amount filters are absent", async () => {
    const { getCombinedTransactions } = await import("./transaction.service");
    paymentCountMock.mockResolvedValue(7);

    const result = await getCombinedTransactions("workspace-1", {
      skip: 5,
      take: 10,
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      transactionTypes: [PaymentTransactionType.INCOME],
      accountIds: ["account-1"],
      categoryIds: ["category-1"],
      userIds: ["user-1"],
      description: "salary",
    });

    expect(result).toEqual({ data: [], total: 7 });
    expect(paymentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-1",
          date: {
            gte: new Date("2026-04-01T00:00:00"),
            lte: new Date("2026-04-30T23:59:59.999"),
          },
          type: { in: [PaymentTransactionType.INCOME] },
          accountId: { in: ["account-1"] },
          categoryId: { in: ["category-1"] },
          description: { contains: "salary", mode: "insensitive" },
          account: {
            is: {
              ownerId: { in: ["user-1"] },
            },
          },
        },
        orderBy: { date: "desc" },
        take: 15,
      })
    );
    expect(paymentCountMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: "workspace-1",
        type: { in: [PaymentTransactionType.INCOME] },
      }),
    });
    expect(transferFindManyMock).not.toHaveBeenCalled();
    expect(debtTransactionFindManyMock).not.toHaveBeenCalled();
  });

  it("pushes transfer account, owner, description, date, and type filters into Prisma", async () => {
    const { getCombinedTransactions } = await import("./transaction.service");
    transferCountMock.mockResolvedValue(3);

    const result = await getCombinedTransactions("workspace-1", {
      take: 20,
      dateFrom: "2026-05-01",
      transactionTypes: [TRANSFER_TRANSACTION_FILTER_VALUE],
      accountIds: ["account-1", "account-2"],
      userIds: ["user-1"],
      description: "fx",
    });

    expect(result).toEqual({ data: [], total: 3 });
    expect(transferFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-1",
          date: {
            gte: new Date("2026-05-01T00:00:00"),
          },
          description: { contains: "fx", mode: "insensitive" },
          OR: [
            { fromAccountId: { in: ["account-1", "account-2"] } },
            { toAccountId: { in: ["account-1", "account-2"] } },
          ],
          AND: [
            {
              OR: [
                { fromAccount: { is: { ownerId: { in: ["user-1"] } } } },
                { toAccount: { is: { ownerId: { in: ["user-1"] } } } },
              ],
            },
          ],
        },
        take: 20,
      })
    );
    expect(paymentFindManyMock).not.toHaveBeenCalled();
    expect(debtTransactionFindManyMock).not.toHaveBeenCalled();
  });

  it("keeps exact totals by post-filtering amount ranges after database filters", async () => {
    const { getCombinedTransactions } = await import("./transaction.service");
    paymentFindManyMock.mockResolvedValue([
      createPaymentTransaction("payment-small", "50"),
      createPaymentTransaction("payment-large", "150"),
    ]);
    transferFindManyMock.mockResolvedValue([createTransferTransaction("transfer-large", "20", "200")]);
    debtTransactionFindManyMock.mockResolvedValue([createDebtTransaction("debt-small", "10")]);

    const result = await getCombinedTransactions("workspace-1", {
      amountFrom: "100",
      transactionTypes: [
        PaymentTransactionType.EXPENSE,
        TRANSFER_TRANSACTION_FILTER_VALUE,
        DEBT_TRANSACTION_FILTER_VALUE,
      ],
    });

    expect("data" in result ? result.total : 0).toBe(2);
    expect("data" in result ? result.data.map((item) => item.data.id) : []).toEqual([
      "transfer-large",
      "payment-large",
    ]);
    expect(paymentFindManyMock).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
    expect(transferFindManyMock).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
    expect(debtTransactionFindManyMock).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.any(Number) }));
    expect(paymentCountMock).not.toHaveBeenCalled();
    expect(transferCountMock).not.toHaveBeenCalled();
    expect(debtTransactionCountMock).not.toHaveBeenCalled();
  });
});
