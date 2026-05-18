import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { AccountWithBalance } from "@/modules/accounts/account.types";
import type { DebtWithRelations } from "@/modules/debts/debt.types";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import { accountKeys, debtKeys, transactionKeys } from "@/shared/lib/query-keys";

import {
  createWorkspaceOptimisticContext,
  insertDebtsInCache,
  insertTransactionsInCache,
  invalidateOptimisticWorkspaceDomains,
  removeDebtsFromCache,
  removeTransactionsFromCache,
  rollbackWorkspaceSnapshot,
  runOptimisticWorkspaceMutation,
  snapshotWorkspaceQueries,
  updateAccountBalancesInCache,
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

function makeDebt(id: string, accountId: string): DebtWithRelations {
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
    },
  } as DebtWithRelations;
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
      category: null,
    },
  } as unknown as CombinedTransaction;
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
      data: [makeDebt("debt-1", "acc-2")],
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
