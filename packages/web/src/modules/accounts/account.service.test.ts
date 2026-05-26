import { beforeEach, describe, expect, it, vi } from "vitest";

const archiveApiAccountMock = vi.fn();
const createApiAccountMock = vi.fn();
const deleteApiArchivedAccountMock = vi.fn();
const getApiAccountMock = vi.fn();
const listApiAccountsMock = vi.fn();
const listApiArchivedAccountsMock = vi.fn();
const unarchiveApiAccountMock = vi.fn();
const updateApiAccountMock = vi.fn();
const updateApiAccountsOrderMock = vi.fn();
const getServerApiRequestOptionsMock = vi.fn();
const revalidateAccountingRoutesMock = vi.fn();

vi.mock("@/shared/api/generated/accounts/accounts", () => ({
  archiveAccount: archiveApiAccountMock,
  createAccount: createApiAccountMock,
  deleteArchivedAccount: deleteApiArchivedAccountMock,
  getAccount: getApiAccountMock,
  listAccounts: listApiAccountsMock,
  listArchivedAccounts: listApiArchivedAccountsMock,
  unarchiveAccount: unarchiveApiAccountMock,
  updateAccount: updateApiAccountMock,
  updateAccountsOrder: updateApiAccountsOrderMock,
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

function createAccountDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    workspaceId: "workspace-1",
    ownerId: "user-1",
    name: "Cash",
    balance: "100.00",
    currency: "BYN",
    description: null,
    color: "#ef4444",
    icon: "Wallet",
    archived: false,
    order: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    owner: {
      id: "user-1",
      name: "Finn",
      email: "finn@example.com",
      image: null,
    },
    ...overrides,
  };
}

describe("account.service API adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerApiRequestOptionsMock.mockResolvedValue(requestOptions);
  });

  it("maps active account lists to the legacy ActionResult shape", async () => {
    listApiAccountsMock.mockResolvedValue({
      accounts: [createAccountDto({ owner: undefined, ownerId: null })],
    });

    const { getAccounts } = await import("./account.service");
    const result = await getAccounts("workspace-1");

    expect(listApiAccountsMock).toHaveBeenCalledWith("workspace-1", requestOptions);
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "account-1",
          ownerId: null,
          owner: null,
          color: "#ef4444",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        }),
      ],
    });
  });

  it("serializes create and update dates before calling the API", async () => {
    createApiAccountMock.mockResolvedValue({ account: createAccountDto() });
    updateApiAccountMock.mockResolvedValue({ account: createAccountDto({ name: "Card" }) });

    const { createAccount, updateAccount } = await import("./account.service");

    await expect(
      createAccount("workspace-1", {
        name: "Cash",
        balance: "100.00",
        currency: "BYN",
        ownerId: null,
        color: "#ef4444",
        icon: "Wallet",
        createdAt: new Date("2026-05-03T10:00:00.000Z"),
      })
    ).resolves.toMatchObject({
      data: expect.objectContaining({ id: "account-1" }),
    });

    await expect(
      updateAccount("account-1", {
        name: "Card",
        createdAt: new Date("2026-05-04T10:00:00.000Z"),
      })
    ).resolves.toMatchObject({
      data: expect.objectContaining({ name: "Card" }),
    });

    expect(createApiAccountMock).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        createdAt: "2026-05-03T10:00:00.000Z",
        ownerId: null,
      }),
      requestOptions
    );
    expect(updateApiAccountMock).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({
        createdAt: "2026-05-04T10:00:00.000Z",
      }),
      requestOptions
    );
    expect(revalidateAccountingRoutesMock).toHaveBeenCalledTimes(2);
  });

  it("passes archived dependency counts through unchanged", async () => {
    listApiArchivedAccountsMock.mockResolvedValue({
      accounts: [
        createAccountDto({
          archived: true,
          _count: {
            transactions: 3,
            debts: 2,
            debtTransactions: 1,
          },
        }),
      ],
    });

    const { getArchivedAccounts } = await import("./account.service");

    await expect(getArchivedAccounts("workspace-1")).resolves.toEqual({
      data: [
        expect.objectContaining({
          archived: true,
          _count: {
            transactions: 3,
            debts: 2,
            debtTransactions: 1,
          },
        }),
      ],
    });
  });

  it("synthesizes success results and revalidates after account mutations", async () => {
    archiveApiAccountMock.mockResolvedValue({ success: true });
    unarchiveApiAccountMock.mockResolvedValue({ success: true });
    deleteApiArchivedAccountMock.mockResolvedValue(undefined);
    updateApiAccountsOrderMock.mockResolvedValue({ success: true });

    const { archiveAccount, deleteArchivedAccount, unarchiveAccount, updateAccountsOrder } = await import(
      "./account.service"
    );

    await expect(archiveAccount("account-1")).resolves.toEqual({ success: true });
    await expect(unarchiveAccount("account-1")).resolves.toEqual({ success: true });
    await expect(deleteArchivedAccount("account-1")).resolves.toEqual({ success: true });
    await expect(
      updateAccountsOrder("workspace-1", {
        accountOrders: [{ id: "account-1", order: 2 }],
      })
    ).resolves.toEqual({ success: true });

    expect(updateApiAccountsOrderMock).toHaveBeenCalledWith(
      "workspace-1",
      { accountOrders: [{ id: "account-1", order: 2 }] },
      requestOptions
    );
    expect(revalidateAccountingRoutesMock).toHaveBeenCalledTimes(4);
  });

  it("wraps getAccount responses and normalizes API failures", async () => {
    getApiAccountMock.mockResolvedValue({ account: createAccountDto({ id: "account-2" }) });
    listApiAccountsMock.mockRejectedValue(new Error("No session"));

    const { getAccount, getAccounts } = await import("./account.service");

    await expect(getAccount("account-2")).resolves.toEqual({
      data: expect.objectContaining({ id: "account-2" }),
    });
    await expect(getAccounts("workspace-1")).resolves.toEqual({ error: "No session" });
  });
});
