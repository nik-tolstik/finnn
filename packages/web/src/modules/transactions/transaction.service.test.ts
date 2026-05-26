import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryType } from "@/modules/categories/category.constants";

import { PaymentTransactionType } from "./transaction.constants";

const createApiPaymentTransactionMock = vi.fn();
const createApiTransferTransactionMock = vi.fn();
const deleteApiPaymentTransactionMock = vi.fn();
const deleteApiTransferTransactionMock = vi.fn();
const getApiCombinedTransactionsMock = vi.fn();
const updateApiPaymentTransactionMock = vi.fn();
const updateApiTransferTransactionMock = vi.fn();
const getServerApiRequestOptionsMock = vi.fn();
const revalidateAccountingRoutesMock = vi.fn();

vi.mock("@/shared/api/generated/transactions/transactions", () => ({
  createPaymentTransaction: createApiPaymentTransactionMock,
  createTransferTransaction: createApiTransferTransactionMock,
  deletePaymentTransaction: deleteApiPaymentTransactionMock,
  deleteTransferTransaction: deleteApiTransferTransactionMock,
  getCombinedTransactions: getApiCombinedTransactionsMock,
  updatePaymentTransaction: updateApiPaymentTransactionMock,
  updateTransferTransaction: updateApiTransferTransactionMock,
}));

vi.mock("@/shared/lib/api-session", () => ({
  getServerApiRequestOptions: getServerApiRequestOptionsMock,
}));

vi.mock("@/shared/lib/revalidate-app-routes", () => ({
  revalidateAccountingRoutes: revalidateAccountingRoutesMock,
}));

const requestOptions = {
  cache: "no-store",
  headers: { cookie: "finnn_session=token" },
};

function createAccountDto(id = "account-1", ownerId: string | null = "user-1") {
  return {
    id,
    name: id,
    currency: "USD",
    color: null,
    icon: null,
    ownerId,
    owner: ownerId
      ? {
          id: ownerId,
          name: ownerId,
          email: `${ownerId}@example.com`,
          image: null,
        }
      : null,
  };
}

function createPaymentTransactionDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-1",
    workspaceId: "workspace-1",
    accountId: "account-1",
    amount: "125.50",
    type: "expense",
    description: "Groceries",
    date: "2026-04-01T10:00:00.000Z",
    categoryId: "category-1",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-02T10:00:00.000Z",
    account: createAccountDto("account-1"),
    category: {
      id: "category-1",
      name: "Food",
    },
    ...overrides,
  };
}

function createTransferTransactionDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    workspaceId: "workspace-1",
    fromAccountId: "account-1",
    toAccountId: "account-2",
    createdById: "user-1",
    amount: "50",
    toAmount: "49.50",
    description: "Move cash",
    date: "2026-04-03T10:00:00.000Z",
    createdAt: "2026-04-03T10:00:00.000Z",
    updatedAt: "2026-04-04T10:00:00.000Z",
    fromAccount: createAccountDto("account-1"),
    toAccount: createAccountDto("account-2", null),
    createdBy: {
      id: "user-1",
      name: "User",
      email: "user@example.com",
      image: null,
    },
    ...overrides,
  };
}

function createDebtTransactionDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-transaction-1",
    workspaceId: "workspace-1",
    debtId: "debt-1",
    accountId: "account-1",
    type: "created",
    amount: "300",
    toAmount: null,
    date: "2026-04-05T10:00:00.000Z",
    createdAt: "2026-04-05T10:00:00.000Z",
    debt: {
      id: "debt-1",
      workspaceId: "workspace-1",
      type: "lent",
      personName: "Alex",
      amount: "300",
      remainingAmount: "300",
      currency: "USD",
      accountId: "account-1",
      date: "2026-04-05T10:00:00.000Z",
      status: "open",
      createdAt: "2026-04-05T10:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    },
    account: createAccountDto("account-1"),
    ...overrides,
  };
}

describe("transaction.service API adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerApiRequestOptionsMock.mockResolvedValue(requestOptions);
  });

  it("maps combined transaction DTOs to the legacy paginated Date shape", async () => {
    getApiCombinedTransactionsMock.mockResolvedValue({
      data: [
        {
          kind: "paymentTransaction",
          data: createPaymentTransactionDto({ category: null, categoryId: null }),
        },
        {
          kind: "transferTransaction",
          data: createTransferTransactionDto(),
        },
        {
          kind: "debtTransaction",
          data: createDebtTransactionDto(),
        },
      ],
      total: 3,
    });

    const { getCombinedTransactions } = await import("./transaction.service");
    const result = await getCombinedTransactions("workspace-1", {
      skip: 5,
      take: 10,
      transactionTypes: [PaymentTransactionType.EXPENSE, "transfer", "debt"],
      accountIds: ["account-1"],
      includeDebtTransactions: true,
    });

    expect(getApiCombinedTransactionsMock).toHaveBeenCalledWith(
      "workspace-1",
      {
        skip: 5,
        take: 10,
        amountFrom: undefined,
        amountTo: undefined,
        userIds: undefined,
        transactionTypes: [PaymentTransactionType.EXPENSE, "transfer", "debt"],
        categoryIds: undefined,
        accountIds: ["account-1"],
        description: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        includeDebtTransactions: true,
      },
      requestOptions
    );
    expect(result).toEqual({
      data: [
        {
          kind: "paymentTransaction",
          data: expect.objectContaining({
            id: "payment-1",
            categoryId: null,
            category: null,
            date: new Date("2026-04-01T10:00:00.000Z"),
            updatedAt: new Date("2026-04-02T10:00:00.000Z"),
          }),
        },
        {
          kind: "transferTransaction",
          data: expect.objectContaining({
            id: "transfer-1",
            toAccount: expect.objectContaining({ ownerId: null, owner: null }),
            createdBy: expect.objectContaining({ id: "user-1" }),
            date: new Date("2026-04-03T10:00:00.000Z"),
          }),
        },
        {
          kind: "debtTransaction",
          data: expect.objectContaining({
            id: "debt-transaction-1",
            date: new Date("2026-04-05T10:00:00.000Z"),
            debt: expect.objectContaining({
              updatedAt: new Date("2026-04-06T10:00:00.000Z"),
            }),
          }),
        },
      ],
      total: 3,
    });
  });

  it("serializes payment mutation dates, unwraps responses, and revalidates", async () => {
    createApiPaymentTransactionMock.mockResolvedValue({
      transaction: createPaymentTransactionDto({ id: "payment-new" }),
    });
    updateApiPaymentTransactionMock.mockResolvedValue({
      transaction: createPaymentTransactionDto({ id: "payment-1", amount: "99" }),
    });

    const { createPaymentTransaction, updatePaymentTransaction } = await import("./transaction.service");

    await expect(
      createPaymentTransaction("workspace-1", {
        accountId: "account-1",
        amount: "125.50",
        type: PaymentTransactionType.EXPENSE,
        description: "Groceries",
        date: new Date("2026-04-07T12:00:00.000Z"),
        categoryId: "category-1",
        newCategory: { name: "Food", type: CategoryType.EXPENSE },
      })
    ).resolves.toEqual({
      data: expect.objectContaining({ id: "payment-new", date: new Date("2026-04-01T10:00:00.000Z") }),
    });
    await expect(
      updatePaymentTransaction("payment-1", {
        amount: "99",
        date: new Date("2026-04-08T12:00:00.000Z"),
        categoryId: null,
      })
    ).resolves.toEqual({
      data: expect.objectContaining({ id: "payment-1", amount: "99" }),
    });

    expect(createApiPaymentTransactionMock).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        date: "2026-04-07T12:00:00.000Z",
        newCategory: { name: "Food", type: CategoryType.EXPENSE },
      }),
      requestOptions
    );
    expect(updateApiPaymentTransactionMock).toHaveBeenCalledWith(
      "payment-1",
      expect.objectContaining({
        date: "2026-04-08T12:00:00.000Z",
        categoryId: null,
      }),
      requestOptions
    );
    expect(revalidateAccountingRoutesMock).toHaveBeenCalledTimes(2);
  });

  it("serializes transfer mutation dates and preserves success result compatibility", async () => {
    createApiTransferTransactionMock.mockResolvedValue({
      transfer: createTransferTransactionDto({ id: "transfer-new" }),
    });
    updateApiTransferTransactionMock.mockResolvedValue({
      transfer: createTransferTransactionDto({ id: "transfer-1" }),
    });
    deleteApiTransferTransactionMock.mockResolvedValue(undefined);
    deleteApiPaymentTransactionMock.mockResolvedValue(undefined);

    const {
      createTransferTransaction,
      deletePaymentTransaction,
      deleteTransferTransaction,
      updateTransferTransaction,
    } = await import("./transaction.service");

    await expect(
      createTransferTransaction("workspace-1", {
        fromAccountId: "account-1",
        toAccountId: "account-2",
        amount: "50",
        toAmount: "49.50",
        description: "Move cash",
        date: new Date("2026-04-09T12:00:00.000Z"),
      })
    ).resolves.toEqual({
      data: expect.objectContaining({ id: "transfer-new" }),
    });
    await expect(
      updateTransferTransaction("transfer-1", {
        fromAccountId: "account-1",
        toAccountId: "account-2",
        amount: "60",
        toAmount: "59.50",
        date: new Date("2026-04-10T12:00:00.000Z"),
      })
    ).resolves.toEqual({ success: true });
    await expect(deleteTransferTransaction("transfer-1")).resolves.toEqual({ success: true });
    await expect(deletePaymentTransaction("payment-1")).resolves.toEqual({ success: true });

    expect(createApiTransferTransactionMock).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({ date: "2026-04-09T12:00:00.000Z" }),
      requestOptions
    );
    expect(updateApiTransferTransactionMock).toHaveBeenCalledWith(
      "transfer-1",
      expect.objectContaining({ date: "2026-04-10T12:00:00.000Z" }),
      requestOptions
    );
    expect(revalidateAccountingRoutesMock).toHaveBeenCalledTimes(4);
  });

  it("normalizes API failures into legacy action errors", async () => {
    getApiCombinedTransactionsMock.mockRejectedValue(new Error("No access"));

    const { getCombinedTransactions } = await import("./transaction.service");

    await expect(getCombinedTransactions("workspace-1")).resolves.toEqual({ error: "No access" });
  });
});
