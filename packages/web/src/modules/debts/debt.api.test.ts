import { beforeEach, describe, expect, it, vi } from "vitest";

import { DebtStatus, DebtTransactionType, DebtType } from "./debt.constants";

const addToApiDebtMock = vi.fn();
const closeApiDebtMock = vi.fn();
const createApiDebtMock = vi.fn();
const deleteApiDebtMock = vi.fn();
const deleteApiDebtTransactionMock = vi.fn();
const getApiDebtEditDataMock = vi.fn();
const listApiDebtsMock = vi.fn();
const updateApiDebtMock = vi.fn();
const updateApiDebtTransactionMock = vi.fn();

vi.mock("@/shared/api/generated/debts/debts", () => ({
  addToDebt: addToApiDebtMock,
  closeDebt: closeApiDebtMock,
  createDebt: createApiDebtMock,
  deleteDebt: deleteApiDebtMock,
  deleteDebtTransaction: deleteApiDebtTransactionMock,
  getDebtEditData: getApiDebtEditDataMock,
  listDebts: listApiDebtsMock,
  updateDebt: updateApiDebtMock,
  updateDebtTransaction: updateApiDebtTransactionMock,
}));

const requestOptions = {
  cache: "no-store" as const,
  headers: { cookie: "finnn_session=token" },
};

function createDebtDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-1",
    workspaceId: "workspace-1",
    type: DebtType.LENT,
    personName: "Alex",
    amount: "100",
    remainingAmount: "75",
    currency: "USD",
    accountId: "account-1",
    date: "2026-04-01T00:00:00.000Z",
    status: DebtStatus.OPEN,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
    account: {
      id: "account-1",
      name: "Cash",
      currency: "USD",
      color: null,
      icon: "Wallet",
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
    type: DebtTransactionType.CLOSED,
    amount: "25",
    toAmount: null,
    date: "2026-04-03T00:00:00.000Z",
    createdAt: "2026-04-03T00:00:00.000Z",
    debt: {
      id: "debt-1",
      workspaceId: "workspace-1",
      type: DebtType.LENT,
      personName: "Alex",
      amount: "100",
      remainingAmount: "75",
      currency: "USD",
      accountId: "account-1",
      date: "2026-04-01T00:00:00.000Z",
      status: DebtStatus.OPEN,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    },
    account: {
      id: "account-1",
      name: "Cash",
      currency: "USD",
      color: null,
      icon: "Wallet",
      ownerId: "user-1",
      owner: {
        id: "user-1",
        name: "Finn",
        email: "finn@example.com",
        image: null,
      },
    },
    ...overrides,
  };
}

describe("debt.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps debt lists to the UI-facing Date shape and forwards filters", async () => {
    listApiDebtsMock.mockResolvedValue({
      data: [createDebtDto({ accountId: null, account: null })],
      total: 1,
    });

    const { getDebts } = await import("./debt.api");
    const result = await getDebts(
      "workspace-1",
      {
        status: DebtStatus.CLOSED,
        type: DebtType.BORROWED,
        personName: "alex",
      },
      requestOptions
    );

    expect(listApiDebtsMock).toHaveBeenCalledWith(
      "workspace-1",
      {
        status: DebtStatus.CLOSED,
        type: DebtType.BORROWED,
        personName: "alex",
      },
      requestOptions
    );
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "debt-1",
          accountId: null,
          account: null,
          date: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-02T00:00:00.000Z"),
        }),
      ],
      total: 1,
    });
  });

  it("serializes debt mutation dates, unwraps responses, and forwards request options", async () => {
    createApiDebtMock.mockResolvedValue({ debt: createDebtDto({ id: "debt-new" }) });
    updateApiDebtMock.mockResolvedValue({ debt: createDebtDto({ personName: "Mira" }) });

    const { createDebt, updateDebt } = await import("./debt.api");

    await expect(
      createDebt(
        "workspace-1",
        {
          type: DebtType.LENT,
          personName: "Alex",
          amount: "100",
          date: new Date("2026-04-04T12:00:00.000Z"),
          useAccount: true,
          accountId: "account-1",
        },
        requestOptions
      )
    ).resolves.toEqual({
      data: expect.objectContaining({ id: "debt-new", date: new Date("2026-04-01T00:00:00.000Z") }),
    });
    await expect(
      updateDebt(
        "debt-1",
        {
          personName: "Mira",
          amount: "125",
          date: new Date("2026-04-05T12:00:00.000Z"),
        },
        requestOptions
      )
    ).resolves.toEqual({
      data: expect.objectContaining({ personName: "Mira" }),
    });

    expect(createApiDebtMock).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        date: "2026-04-04T12:00:00.000Z",
        useAccount: true,
        accountId: "account-1",
      }),
      requestOptions
    );
    expect(updateApiDebtMock).toHaveBeenCalledWith(
      "debt-1",
      expect.objectContaining({ date: "2026-04-05T12:00:00.000Z" }),
      requestOptions
    );
  });

  it("adapts add, close, and delete debt mutations to UI-facing action results", async () => {
    addToApiDebtMock.mockResolvedValue({ debt: createDebtDto({ amount: "120" }) });
    closeApiDebtMock.mockResolvedValue({ debt: createDebtDto({ status: DebtStatus.CLOSED, remainingAmount: "0" }) });
    deleteApiDebtMock.mockResolvedValue(undefined);

    const { addToDebt, closeDebt, deleteDebt } = await import("./debt.api");

    await expect(addToDebt("debt-1", { amount: "20", useAccount: false }, requestOptions)).resolves.toEqual({
      data: expect.objectContaining({ amount: "120" }),
    });
    await expect(
      closeDebt(
        "debt-1",
        {
          amount: "75",
          paymentAmount: "80",
          categoryId: "category-1",
          accountId: "account-1",
          useAccount: true,
        },
        requestOptions
      )
    ).resolves.toEqual({
      data: expect.objectContaining({ status: DebtStatus.CLOSED, remainingAmount: "0" }),
    });
    await expect(deleteDebt("debt-1", requestOptions)).resolves.toEqual({ success: true });

    expect(addToApiDebtMock).toHaveBeenCalledWith("debt-1", { amount: "20", useAccount: false }, requestOptions);
    expect(closeApiDebtMock).toHaveBeenCalledWith(
      "debt-1",
      expect.objectContaining({
        amount: "75",
        paymentAmount: "80",
        categoryId: "category-1",
      }),
      requestOptions
    );
  });

  it("normalizes close debt money fields before sending them to the API", async () => {
    closeApiDebtMock.mockResolvedValue({ debt: createDebtDto({ status: DebtStatus.CLOSED, remainingAmount: "0" }) });

    const { closeDebt } = await import("./debt.api");

    await closeDebt(
      "debt-1",
      {
        amount: "75,25",
        paymentAmount: "75,25",
        toAmount: "",
        accountId: "account-1",
        useAccount: true,
      },
      requestOptions
    );

    expect(closeApiDebtMock).toHaveBeenCalledWith(
      "debt-1",
      expect.objectContaining({
        amount: "75.25",
        paymentAmount: "75.25",
        toAmount: undefined,
      }),
      requestOptions
    );
  });

  it("wraps edit-data and debt transaction responses", async () => {
    getApiDebtEditDataMock.mockResolvedValue({
      debt: {
        personName: "Alex",
        initialAmount: "100",
        initialDate: "2026-04-01T00:00:00.000Z",
        currency: "USD",
      },
    });
    updateApiDebtTransactionMock.mockResolvedValue({
      debtTransaction: createDebtTransactionDto({ amount: "30", toAmount: "31.25" }),
    });
    deleteApiDebtTransactionMock.mockResolvedValue(undefined);

    const { deleteDebtTransaction, getDebtEditData, updateDebtTransaction } = await import("./debt.api");

    await expect(getDebtEditData("debt-1", requestOptions)).resolves.toEqual({
      data: {
        personName: "Alex",
        initialAmount: "100",
        initialDate: "2026-04-01T00:00:00.000Z",
        currency: "USD",
      },
    });
    await expect(
      updateDebtTransaction(
        "debt-transaction-1",
        {
          amount: "30",
          toAmount: "31.25",
          accountId: "account-1",
          date: new Date("2026-04-06T12:00:00.000Z"),
        },
        requestOptions
      )
    ).resolves.toEqual({
      data: expect.objectContaining({
        id: "debt-transaction-1",
        amount: "30",
        toAmount: "31.25",
        date: new Date("2026-04-03T00:00:00.000Z"),
        debt: expect.objectContaining({ updatedAt: new Date("2026-04-02T00:00:00.000Z") }),
        account: expect.objectContaining({
          ownerId: "user-1",
          owner: expect.objectContaining({ email: "finn@example.com" }),
        }),
      }),
    });
    await expect(deleteDebtTransaction("debt-transaction-1", requestOptions)).resolves.toEqual({ success: true });

    expect(getApiDebtEditDataMock).toHaveBeenCalledWith("debt-1", requestOptions);
    expect(updateApiDebtTransactionMock).toHaveBeenCalledWith(
      "debt-transaction-1",
      expect.objectContaining({ date: "2026-04-06T12:00:00.000Z" }),
      requestOptions
    );
    expect(deleteApiDebtTransactionMock).toHaveBeenCalledWith("debt-transaction-1", requestOptions);
  });

  it("normalizes API failures into UI-facing action errors", async () => {
    listApiDebtsMock.mockRejectedValue(new Error("No access"));
    createApiDebtMock.mockRejectedValue(new Error("Invalid debt"));

    const { createDebt, getDebts } = await import("./debt.api");

    await expect(getDebts("workspace-1")).rejects.toThrow("Не удалось загрузить долги");
    await expect(
      createDebt("workspace-1", {
        type: DebtType.LENT,
        personName: "Alex",
        amount: "100",
        date: new Date("2026-04-04T12:00:00.000Z"),
        useAccount: false,
        currency: "USD",
      })
    ).resolves.toEqual({ error: "Invalid debt" });
  });
});
