import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { AccountWithBalance } from "@/modules/accounts/account.types";
import type { DebtWithRelations } from "@/modules/debts/debt.types";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import type { WorkspaceSummary, WorkspaceWithOwner } from "@/modules/workspace/workspace.types";
import {
  accountKeys,
  categoryKeys,
  debtKeys,
  transactionKeys,
  workspaceKeys,
  workspacesKeys,
} from "@/shared/lib/query-keys";

import {
  createWorkspaceOptimisticContext,
  insertDebtsInCache,
  insertTransactionsInCache,
  insertWorkspacesInCache,
  invalidateOptimisticWorkspaceDomains,
  moveAccountArchiveStateInCache,
  removeAccountsInCache,
  removeCategoriesInCache,
  removeDebtsFromCache,
  removeTransactionsFromCache,
  removeWorkspacesFromCache,
  removeWorkspacesInCache,
  rollbackWorkspaceSnapshot,
  runOptimisticWorkspaceMutation,
  snapshotWorkspaceQueries,
  updateAccountBalancesInCache,
  updateTransactionsInCache,
  updateUserReferencesInCache,
  updateWorkspaceCaches,
} from "./optimistic-workspace-updates";

const WORKSPACE_ID = "workspace-1";
const OTHER_WORKSPACE_ID = "workspace-other";

function makeAccount(id: string, balance: string): AccountWithBalance {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    name: `Account ${id}`,
    currency: "USD",
    color: "#000000",
    icon: "Wallet",
    ownerId: null,
    owner: null,
    description: null,
    archived: false,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    balance,
  } as AccountWithBalance;
}

function makeDebt(id: string, accountId: string, balance = "0"): DebtWithRelations {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    type: "lent",
    personName: "Alex",
    accountId,
    amount: "100",
    remainingAmount: "80",
    currency: "USD",
    status: "open",
    date: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    account: {
      id: accountId,
      name: `Account ${accountId}`,
      currency: "USD",
      color: "#000000",
      icon: "Wallet",
      balance,
    },
  } as DebtWithRelations;
}

function makeWorkspaceSummary(id: string, name = `Workspace ${id}`, ownerId = "owner-1"): WorkspaceSummary {
  return {
    id,
    name,
    icon: null,
    baseCurrency: "USD",
    ownerId,
  };
}

function makeWorkspaceWithOwner(
  id: string,
  name = `Workspace ${id}`,
  createdAt: Date = new Date(),
  ownerId = "owner-1"
): WorkspaceWithOwner {
  return {
    id,
    name,
    icon: null,
    slug: `workspace-${id}`,
    ownerId,
    baseCurrency: "USD",
    createdAt,
    updatedAt: new Date(),
    order: 0,
    archived: false,
    owner: {
      id: ownerId,
      name: "Owner",
      email: "owner@example.com",
      image: null,
    },
    _count: {
      members: 1,
    },
  } as WorkspaceWithOwner;
}

function makeTransactionAccount(id: string, balance: string) {
  return {
    id,
    name: `Account ${id}`,
    currency: "USD",
    color: "#000000",
    icon: "Wallet",
    ownerId: null,
    owner: {
      id: "owner-1",
      name: "Owner",
      email: "owner@example.com",
      image: null,
    },
    balance,
  };
}

function makePaymentTransaction(id: string, date: string, accountId: string, balance: string): CombinedTransaction {
  return {
    kind: "paymentTransaction",
    data: {
      id,
      workspaceId: WORKSPACE_ID,
      date,
      type: "expense",
      amount: "1",
      accountId,
      description: null,
      createdById: null,
      categoryId: null,
      createdAt: new Date(date),
      updatedAt: new Date(date),
      ownerId: null,
      account: makeTransactionAccount(accountId, balance),
    },
  } as unknown as CombinedTransaction;
}

function _makePaymentTransactionWithCategory(
  id: string,
  date: string,
  accountId: string,
  balance: string,
  category: { id: string; name: string; type: "expense" | "income"; color: string; order: number; isEnabled: boolean }
): CombinedTransaction {
  const transaction = makePaymentTransaction(id, date, accountId, balance);
  if (transaction.kind === "paymentTransaction") {
    return {
      ...transaction,
      data: {
        ...transaction.data,
        category,
      },
    } as CombinedTransaction;
  }

  return transaction;
}

function makeTransferTransaction(
  id: string,
  date: string,
  fromAccountId: string,
  fromBalance: string,
  toAccountId: string,
  toBalance: string
): CombinedTransaction {
  return {
    kind: "transferTransaction",
    data: {
      id,
      workspaceId: WORKSPACE_ID,
      date,
      type: "expense",
      amount: "1",
      fromAmount: "1",
      toAmount: "1",
      description: null,
      fromAccountId,
      toAccountId,
      createdById: null,
      fromAccount: makeTransactionAccount(fromAccountId, fromBalance),
      toAccount: makeTransactionAccount(toAccountId, toBalance),
      createdBy: null,
      fromCurrency: "USD",
      toCurrency: "USD",
      exchangeRate: "1",
      createdAt: new Date(date),
      updatedAt: new Date(date),
      deletedAt: null,
    },
  } as unknown as CombinedTransaction;
}

function seedClient(queryClient: QueryClient) {
  queryClient.setQueryData(accountKeys.list(WORKSPACE_ID), {
    data: [makeAccount("acc-1", "10"), makeAccount("acc-2", "20")],
  });

  queryClient.setQueryData(transactionKeys.list(WORKSPACE_ID, {}), {
    data: [makePaymentTransaction("tx-1", "2024-02-01T00:00:00.000Z", "acc-1", "10")],
    total: 1,
  });

  queryClient.setQueryData(debtKeys.list(WORKSPACE_ID), {
    data: [makeDebt("debt-1", "acc-1")],
    total: 1,
  });

  queryClient.setQueryData(accountKeys.list(OTHER_WORKSPACE_ID), {
    data: [makeAccount("other", "999")],
  });
}

describe("optimistic workspace updates", () => {
  it("snapshots matching queries and rolls back changes", async () => {
    const queryClient = new QueryClient();
    seedClient(queryClient);
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["accounts", "transactions", "debts"]);
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");

    await snapshotWorkspaceQueries(context);

    expect(cancelSpy).toHaveBeenCalledTimes(3);
    expect(context.snapshots).toHaveLength(3);

    queryClient.setQueryData(accountKeys.list(WORKSPACE_ID), { data: [makeAccount("acc-1", "999")] });

    rollbackWorkspaceSnapshot(context);

    const restored = queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as { data: AccountWithBalance[] };

    expect(restored?.data).toHaveLength(2);
    expect(restored?.data?.[0]).toEqual(expect.objectContaining({ id: "acc-1", balance: "10" }));
    expect(restored?.data?.[1]).toEqual(expect.objectContaining({ id: "acc-2", balance: "20" }));
  });

  it("updates account balances inside account, transaction, and debt caches", async () => {
    const queryClient = new QueryClient();
    const transactionList = [
      makePaymentTransaction("tx-1", "2024-02-01T00:00:00.000Z", "acc-1", "10"),
      makeTransferTransaction("tx-2", "2024-01-01T00:00:00.000Z", "acc-1", "10", "acc-2", "20"),
    ];

    queryClient.setQueryData(accountKeys.list(WORKSPACE_ID), {
      data: [makeAccount("acc-1", "10"), makeAccount("acc-2", "20")],
    });
    queryClient.setQueryData(transactionKeys.list(WORKSPACE_ID, {}), {
      data: transactionList,
      total: 2,
    });
    queryClient.setQueryData(debtKeys.list(WORKSPACE_ID), {
      data: [makeDebt("debt-1", "acc-2", "20")],
      total: 1,
    });

    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["accounts", "transactions", "debts"]);
    await snapshotWorkspaceQueries(context);

    updateAccountBalancesInCache(context, { "acc-1": "5", "acc-2": "-5" });

    const accounts = (
      queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as {
        data: AccountWithBalance[];
      }
    ).data;

    const updatedTransactions = (
      queryClient.getQueryData(transactionKeys.list(WORKSPACE_ID, {})) as {
        data: CombinedTransaction[];
      }
    ).data;
    const updatedDebts = (
      queryClient.getQueryData(debtKeys.list(WORKSPACE_ID)) as {
        data: DebtWithRelations[];
      }
    ).data;

    expect(accounts[0]).toEqual(expect.objectContaining({ id: "acc-1", balance: "15" }));
    expect(accounts[1]).toEqual(expect.objectContaining({ id: "acc-2", balance: "15" }));
    const paymentTransaction = updatedTransactions[0];
    const transferTransaction = updatedTransactions[1];

    expect(paymentTransaction?.kind).toBe("paymentTransaction");
    if (paymentTransaction?.kind === "paymentTransaction") {
      expect((paymentTransaction.data.account as { balance?: string }).balance).toBe("15");
    }

    expect(transferTransaction?.kind).toBe("transferTransaction");
    if (transferTransaction?.kind === "transferTransaction") {
      expect((transferTransaction.data.fromAccount as { balance?: string }).balance).toBe("15");
      expect((transferTransaction.data.toAccount as { balance?: string }).balance).toBe("15");
    }

    expect(updatedDebts?.[0]?.account).toMatchObject({ id: "acc-2", balance: "15" });
  });

  it("removes and inserts transactions with preserved sorting and totals", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["transactions"]);
    const baseTransactions = [
      makePaymentTransaction("tx-old", "2024-01-01T00:00:00.000Z", "acc-1", "10"),
      makePaymentTransaction("tx-mid", "2024-02-01T00:00:00.000Z", "acc-2", "20"),
    ];

    queryClient.setQueryData(transactionKeys.list(WORKSPACE_ID, {}), {
      data: baseTransactions,
      total: 2,
    });
    await snapshotWorkspaceQueries(context);

    removeTransactionsFromCache(context, ["tx-mid"]);

    const afterRemoval = queryClient.getQueryData(transactionKeys.list(WORKSPACE_ID, {})) as {
      data: CombinedTransaction[];
      total: number;
    };

    expect(afterRemoval).toEqual({
      data: [makePaymentTransaction("tx-old", "2024-01-01T00:00:00.000Z", "acc-1", "10")],
      total: 1,
    });

    insertTransactionsInCache(context, [makePaymentTransaction("tx-new", "2024-03-01T00:00:00.000Z", "acc-1", "10")]);

    const afterInsert = queryClient.getQueryData(transactionKeys.list(WORKSPACE_ID, {})) as {
      data: CombinedTransaction[];
      total: number;
    };
    const queryKeysAfterInsert = afterInsert.data.map((tx) => tx.data.id);

    expect(afterInsert.total).toBe(2);
    expect(queryKeysAfterInsert).toEqual(["tx-new", "tx-old"]);
  });

  it("removes and inserts debts with preserved sorting and totals", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["debts"]);
    const oldDebt = { ...makeDebt("debt-old", "acc-1"), date: new Date("2024-01-01") };
    const midDebt = { ...makeDebt("debt-mid", "acc-2"), date: new Date("2024-02-01") };

    queryClient.setQueryData(debtKeys.list(WORKSPACE_ID), {
      data: [oldDebt, midDebt],
      total: 2,
    });
    await snapshotWorkspaceQueries(context);

    removeDebtsFromCache(context, ["debt-mid"]);

    const afterRemoval = queryClient.getQueryData(debtKeys.list(WORKSPACE_ID)) as {
      data: DebtWithRelations[];
      total: number;
    };

    expect(afterRemoval).toEqual({
      data: [oldDebt],
      total: 1,
    });

    insertDebtsInCache(context, [{ ...makeDebt("debt-new", "acc-1"), date: new Date("2024-03-01") }]);

    const afterInsert = queryClient.getQueryData(debtKeys.list(WORKSPACE_ID)) as {
      data: DebtWithRelations[];
      total: number;
    };

    expect(afterInsert.total).toBe(2);
    expect(afterInsert.data.map((debt) => debt.id)).toEqual(["debt-new", "debt-old"]);
  });

  it("moves an account between active and archived account caches", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["accounts", "archivedAccounts"]);

    queryClient.setQueryData(accountKeys.list(WORKSPACE_ID), {
      data: [makeAccount("acc-1", "10")],
    });
    queryClient.setQueryData(accountKeys.archived(WORKSPACE_ID), {
      data: [],
    });

    await snapshotWorkspaceQueries(context);

    const account = makeAccount("acc-1", "10");
    moveAccountArchiveStateInCache(context, account, true);

    const afterArchive = {
      accounts: queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as { data: AccountWithBalance[] },
      archived: queryClient.getQueryData(accountKeys.archived(WORKSPACE_ID)) as { data: AccountWithBalance[] },
    };

    expect(afterArchive.accounts.data).toHaveLength(0);
    expect(afterArchive.archived.data).toEqual([{ ...account, archived: true }]);

    moveAccountArchiveStateInCache(context, account, false);

    const afterRestore = {
      accounts: queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as { data: AccountWithBalance[] },
      archived: queryClient.getQueryData(accountKeys.archived(WORKSPACE_ID)) as { data: AccountWithBalance[] },
    };

    expect(afterRestore.accounts.data).toEqual([{ ...account, archived: false }]);
    expect(afterRestore.archived.data).toHaveLength(0);
  });

  it("removes accounts and totals using the accounts cache remove API", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["accounts", "archivedAccounts"]);

    queryClient.setQueryData(accountKeys.list(WORKSPACE_ID), {
      data: [makeAccount("acc-1", "10"), makeAccount("acc-2", "20")],
      total: 2,
    });
    queryClient.setQueryData(accountKeys.archived(WORKSPACE_ID), {
      data: [makeAccount("acc-arch", "5")],
      total: 1,
    });
    await snapshotWorkspaceQueries(context);

    const removed = removeAccountsInCache(context, ["acc-1", "acc-arch"]);
    const active = queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as {
      data: AccountWithBalance[];
      total?: number;
    };
    const archived = queryClient.getQueryData(accountKeys.archived(WORKSPACE_ID)) as {
      data: AccountWithBalance[];
      total?: number;
    };

    expect(removed.map((item) => item.id).sort()).toEqual(["acc-1", "acc-arch"]);
    expect(active.data).toHaveLength(1);
    expect(active.data?.[0]).toEqual(expect.objectContaining({ id: "acc-2" }));
    expect(active.total).toBe(1);
    expect(archived.data).toHaveLength(0);
    expect(archived.total).toBe(0);
  });

  it("removes categories and detaches them from transactions", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["categories", "transactions"]);
    const tx = makePaymentTransaction("tx-category", "2024-01-01T00:00:00.000Z", "acc-1", "10");
    if (tx.kind !== "paymentTransaction") {
      throw new Error("Expected payment transaction");
    }

    tx.data.category = {
      id: "cat-1",
      name: "Old",
      type: "expense",
      color: "#000000",
      order: 0,
      isEnabled: true,
    } as any;

    queryClient.setQueryData(categoryKeys.list(WORKSPACE_ID), {
      data: [
        {
          id: "cat-1",
          name: "Old",
          type: "expense",
          color: "#000000",
          order: 0,
          isEnabled: true,
          workspaceId: WORKSPACE_ID,
        },
        {
          id: "cat-2",
          name: "New",
          type: "expense",
          color: "#000000",
          order: 1,
          isEnabled: true,
          workspaceId: WORKSPACE_ID,
        },
      ],
      total: 2,
    });
    queryClient.setQueryData(transactionKeys.list(WORKSPACE_ID, {}), {
      data: [tx],
      total: 1,
    });

    await snapshotWorkspaceQueries(context);

    removeCategoriesInCache(context, ["cat-1"]);

    const remaining = queryClient.getQueryData(categoryKeys.list(WORKSPACE_ID)) as {
      data: Array<{ id: string }>;
      total?: number;
    };
    const updatedTx = (
      queryClient.getQueryData(transactionKeys.list(WORKSPACE_ID, {})) as {
        data: CombinedTransaction[];
        total?: number;
      }
    ).data;

    expect(remaining.data).toEqual([
      expect.objectContaining({
        id: "cat-2",
      }),
    ]);
    expect(remaining.total).toBe(1);
    expect((updatedTx[0] as { kind: "paymentTransaction"; data: { category?: null } }).data.category).toBeNull();
    expect(
      (updatedTx[0] as { kind: "paymentTransaction"; data: { categoryId?: string | null } }).data.categoryId
    ).toBeNull();
  });

  it("updates transaction cache entries in place", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["transactions"]);
    const original = makePaymentTransaction("tx-1", "2024-01-01T00:00:00.000Z", "acc-1", "10");

    queryClient.setQueryData(transactionKeys.list(WORKSPACE_ID, {}), {
      data: [original],
      total: 1,
    });
    await snapshotWorkspaceQueries(context);

    updateTransactionsInCache(context, [makePaymentTransaction("tx-1", "2024-02-01T00:00:00.000Z", "acc-1", "10")]);

    const updated = queryClient.getQueryData(transactionKeys.list(WORKSPACE_ID, {})) as {
      data: CombinedTransaction[];
      total?: number;
    };

    expect(updated.total).toBe(1);
    expect(updated.data[0].data.id).toBe("tx-1");
    expect(updated.data[0].data.date).toBe("2024-02-01T00:00:00.000Z");
  });

  it("updates workspaces and workspace summaries", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, [
      "workspaces",
      "workspaceSummary",
      "workspaceMembers",
    ]);

    queryClient.setQueryData(workspacesKeys.list(), {
      data: [makeWorkspaceWithOwner("ws-old", "Old", new Date("2024-01-01"))],
      total: 1,
    });
    queryClient.setQueryData(workspaceKeys.summary(WORKSPACE_ID), {
      data: makeWorkspaceSummary(WORKSPACE_ID, "Main"),
    });
    queryClient.setQueryData(workspaceKeys.members(WORKSPACE_ID), {
      data: [{ id: "member-1", name: "Old", email: "old@example.com", image: null }],
    });

    await snapshotWorkspaceQueries(context);

    insertWorkspacesInCache(context, [
      makeWorkspaceWithOwner("ws-new", "New", new Date("2024-02-01")),
      makeWorkspaceWithOwner(WORKSPACE_ID, "Main", new Date("2024-03-01")),
    ]);

    const cachedWorkspaces = queryClient.getQueryData(workspacesKeys.list()) as {
      data: WorkspaceWithOwner[];
      total?: number;
    };
    const cachedSummary = queryClient.getQueryData(workspaceKeys.summary(WORKSPACE_ID)) as { data: WorkspaceSummary };
    expect(cachedSummary.data.name).toBe("Main");
    expect(cachedWorkspaces.total).toBe(3);
    expect(cachedWorkspaces.data[0]).toEqual(expect.objectContaining({ id: WORKSPACE_ID }));

    updateWorkspaceCaches(context, { id: WORKSPACE_ID, name: "Updated" });

    const updatedSummary = queryClient.getQueryData(workspaceKeys.summary(WORKSPACE_ID)) as { data: WorkspaceSummary };
    const updatedWorkspaces = queryClient.getQueryData(workspacesKeys.list()) as {
      data: WorkspaceWithOwner[];
    };
    const updatedMembers = queryClient.getQueryData(workspaceKeys.members(WORKSPACE_ID)) as {
      data: Array<{ id: string; name: string }>;
    };

    expect(updatedSummary.data.name).toBe("Updated");
    expect(updatedWorkspaces.data).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Updated" })]));
    expect(updatedMembers.data).toEqual([{ id: "member-1", name: "Old", email: "old@example.com", image: null }]);

    removeWorkspacesInCache(context, ["ws-old"]);
    const afterLegacyRemoval = queryClient.getQueryData(workspacesKeys.list()) as {
      data: WorkspaceWithOwner[];
      total?: number;
    };
    expect(afterLegacyRemoval.total).toBe(2);
    expect(removeWorkspacesFromCache).toBe(removeWorkspacesInCache);
    expect(afterLegacyRemoval.data).toHaveLength(2);
  });

  it("updates user references across accounts, workspace caches, and transactions", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, [
      "accounts",
      "workspaceSummary",
      "workspaceMembers",
      "transactions",
      "workspaces",
    ]);
    const tx = makePaymentTransaction("tx-user", "2024-01-01T00:00:00.000Z", "acc-1", "10");
    if (tx.kind === "paymentTransaction") {
      tx.data.account.owner = {
        id: "user-1",
        name: "Old",
        email: "old@example.com",
        image: null,
      };
    }

    queryClient.setQueryData(accountKeys.list(WORKSPACE_ID), {
      data: [
        { ...makeAccount("acc-1", "10"), owner: { id: "user-1", name: "Old", email: "old@example.com", image: null } },
      ],
    });
    queryClient.setQueryData(transactionKeys.list(WORKSPACE_ID, {}), {
      data: [tx],
      total: 1,
    });
    queryClient.setQueryData(workspaceKeys.summary(WORKSPACE_ID), {
      data: makeWorkspaceSummary(WORKSPACE_ID, "Main"),
    });
    queryClient.setQueryData(workspaceKeys.members(WORKSPACE_ID), {
      data: [{ id: "user-1", name: "Old", email: "old@example.com", image: null }],
    });
    queryClient.setQueryData(workspacesKeys.list(), {
      data: [makeWorkspaceWithOwner(WORKSPACE_ID, "Main", new Date("2024-01-01"), "user-1")],
      total: 1,
    });

    await snapshotWorkspaceQueries(context);

    updateUserReferencesInCache(context, [
      {
        id: "user-1",
        name: "New",
        image: "avatar.png",
        email: "new@example.com",
      },
    ]);

    const updatedAccounts = queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as {
      data: Array<
        AccountWithBalance & { owner?: { id: string; name: string | null; image: string | null; email: string } | null }
      >;
    };
    const updatedTransactions = queryClient.getQueryData(transactionKeys.list(WORKSPACE_ID, {})) as {
      data: CombinedTransaction[];
    };
    const updatedMembers = queryClient.getQueryData(workspaceKeys.members(WORKSPACE_ID)) as {
      data: Array<{ id: string; name: string; image: string | null; email: string }>;
    };
    const updatedWorkspaces = queryClient.getQueryData(workspacesKeys.list()) as { data: WorkspaceWithOwner[] };

    expect(updatedAccounts.data[0].owner).toEqual(
      expect.objectContaining({ id: "user-1", name: "New", image: "avatar.png", email: "new@example.com" })
    );
    expect(
      (updatedTransactions.data[0] as { kind: "paymentTransaction"; data: { account: { owner: unknown } } }).data
        .account.owner
    ).toEqual(expect.objectContaining({ id: "user-1", name: "New" }));
    expect(updatedMembers.data[0]).toEqual(
      expect.objectContaining({ id: "user-1", name: "New", image: "avatar.png", email: "new@example.com" })
    );
    expect(updatedWorkspaces.data[0].owner).toEqual(expect.objectContaining({ id: "user-1", name: "New" }));
  });

  it("rolls back optimistic changes when an action returns an error result", async () => {
    const queryClient = new QueryClient();
    seedClient(queryClient);
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    const result = await runOptimisticWorkspaceMutation({
      queryClient,
      workspaceId: WORKSPACE_ID,
      domains: ["accounts"],
      apply: (context) => updateAccountBalancesInCache(context, { "acc-1": "90" }),
      mutation: async () => ({ error: "Rejected" }),
    });

    const accounts = queryClient.getQueryData(accountKeys.list(WORKSPACE_ID)) as { data: AccountWithBalance[] };

    expect(result).toEqual({ error: "Rejected" });
    expect(accounts.data[0]).toEqual(expect.objectContaining({ id: "acc-1", balance: "10" }));
  });

  it("invalidates selected workspace domains on settle", async () => {
    const queryClient = new QueryClient();
    const context = createWorkspaceOptimisticContext(queryClient, WORKSPACE_ID, ["accounts", "debts"]);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateOptimisticWorkspaceDomains(context);

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountKeys.all(WORKSPACE_ID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: debtKeys.all(WORKSPACE_ID) });
  });
});
