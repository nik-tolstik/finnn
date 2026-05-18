import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { AccountWithBalance } from "@/modules/accounts/account.types";
import type { DebtWithRelations } from "@/modules/debts/debt.types";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import { accountKeys, debtKeys, transactionKeys } from "@/shared/lib/query-keys";
import { addMoney } from "@/shared/utils/money";

export type WorkspaceOptimisticDomain = "accounts" | "transactions" | "debts";

export interface WorkspaceQuerySnapshot {
  queryKey: QueryKey;
  data: unknown;
}

export interface WorkspaceOptimisticContext {
  queryClient: QueryClient;
  workspaceId: string;
  domains: WorkspaceOptimisticDomain[];
  snapshots: WorkspaceQuerySnapshot[];
}

export type OptimisticBalanceDeltas = Record<string, string> | Map<string, string>;

export type DebtPatch = Pick<DebtWithRelations, "id"> & Partial<Omit<DebtWithRelations, "id">>;

export interface OptimisticWorkspaceMutationOptions<TResult> {
  queryClient: QueryClient;
  workspaceId: string;
  domains: WorkspaceOptimisticDomain[];
  apply?: (context: WorkspaceOptimisticContext) => void | Promise<void>;
  mutation: () => Promise<TResult>;
}

function toWorkspaceQueryKeys(workspaceId: string) {
  return {
    accounts: accountKeys.all(workspaceId),
    transactions: transactionKeys.all(workspaceId),
    debts: debtKeys.all(workspaceId),
  } as const;
}

function toUniqueArray<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeDomains(domains: WorkspaceOptimisticDomain[]): WorkspaceOptimisticDomain[] {
  return toUniqueArray(domains);
}

function normalizeBalanceDeltas(deltas: OptimisticBalanceDeltas): Map<string, string> {
  return deltas instanceof Map ? deltas : new Map(Object.entries(deltas));
}

function getQueryDomain(queryKey: QueryKey, workspaceId: string): WorkspaceOptimisticDomain | null {
  if (!Array.isArray(queryKey) || queryKey.length < 2) {
    return null;
  }

  const [domain, workspace] = queryKey;

  if (workspace !== workspaceId || typeof domain !== "string") {
    return null;
  }

  if (domain === "accounts" || domain === "transactions" || domain === "debts") {
    return domain;
  }

  return null;
}

function getSnapshotsForDomains(
  context: WorkspaceOptimisticContext,
  domains?: WorkspaceOptimisticDomain[]
): WorkspaceQuerySnapshot[] {
  if (context.snapshots.length === 0) {
    return [];
  }

  const domainSet = new Set(domains ?? context.domains);

  return context.snapshots.filter(({ queryKey }) => {
    const domain = getQueryDomain(queryKey, context.workspaceId);
    return domain !== null && domainSet.has(domain);
  });
}

function mapQueryListData<TItem>(
  data: unknown,
  updater: (items: TItem[]) => { items: TItem[]; total?: number }
): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  const hasData = "data" in data;
  if (!hasData) {
    return data;
  }

  const rawPayload = data as { data: unknown; total?: unknown };
  if (!Array.isArray(rawPayload.data)) {
    return data;
  }

  const transformed = updater(rawPayload.data as TItem[]);

  if (transformed.items === rawPayload.data) {
    return data;
  }

  const nextPayload: { data: TItem[]; total?: unknown } = {
    ...rawPayload,
    data: transformed.items,
  };

  if (typeof transformed.total === "number") {
    nextPayload.total = transformed.total;
  }

  return nextPayload;
}

function hasAccountBalance(value: unknown): value is { id: string; balance: string } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { id?: unknown; balance?: unknown };
  return typeof candidate.id === "string" && typeof candidate.balance === "string";
}

function applyDeltaToAccount<TAccount>(account: TAccount, deltas: Map<string, string>): TAccount {
  if (!hasAccountBalance(account)) {
    return account;
  }

  const delta = deltas.get(account.id);

  if (!delta) {
    return account;
  }

  return {
    ...account,
    balance: addMoney(account.balance, delta),
  } as TAccount;
}

function updateAccountBalanceInTransaction(
  transaction: CombinedTransaction,
  deltas: Map<string, string>
): CombinedTransaction {
  if (transaction.kind === "paymentTransaction") {
    const nextAccount = applyDeltaToAccount(transaction.data.account, deltas);
    if (nextAccount === transaction.data.account) {
      return transaction;
    }

    return {
      ...transaction,
      data: {
        ...transaction.data,
        account: nextAccount,
      },
    };
  }

  if (transaction.kind === "transferTransaction") {
    const nextFromAccount = transaction.data.fromAccount
      ? applyDeltaToAccount(transaction.data.fromAccount, deltas)
      : transaction.data.fromAccount;
    const nextToAccount = transaction.data.toAccount
      ? applyDeltaToAccount(transaction.data.toAccount, deltas)
      : transaction.data.toAccount;
    if (nextFromAccount === transaction.data.fromAccount && nextToAccount === transaction.data.toAccount) {
      return transaction;
    }

    return {
      ...transaction,
      data: {
        ...transaction.data,
        fromAccount: nextFromAccount,
        toAccount: nextToAccount,
      },
    };
  }

  if (!transaction.data.account) {
    return transaction;
  }

  const nextAccount = applyDeltaToAccount(transaction.data.account, deltas);
  if (nextAccount === transaction.data.account) {
    return transaction;
  }

  return {
    ...transaction,
    data: {
      ...transaction.data,
      account: nextAccount,
    },
  };
}

function updateAccountsInList(accounts: AccountWithBalance[], deltas: Map<string, string>): AccountWithBalance[] {
  let didChange = false;

  const next = accounts.map((account) => {
    const nextAccount = applyDeltaToAccount(account, deltas);
    if (nextAccount !== account) {
      didChange = true;
      return nextAccount as AccountWithBalance;
    }

    return account;
  });

  return didChange ? next : accounts;
}

function updateDebtsInList(debts: DebtWithRelations[], patchById: Map<string, DebtPatch>): DebtWithRelations[] {
  let didChange = false;

  const next = debts.map((debt) => {
    const patch = patchById.get(debt.id);
    if (!patch) {
      return debt;
    }

    didChange = true;
    return {
      ...debt,
      ...patch,
      id: debt.id,
    };
  });

  return didChange ? next : debts;
}

function removeDebtsFromList(debts: DebtWithRelations[], debtIds: Set<string>) {
  if (debtIds.size === 0) {
    return {
      items: debts,
      totalAdjustment: 0,
    };
  }

  const next = debts.filter((debt) => !debtIds.has(debt.id));

  return {
    items: next,
    totalAdjustment: debts.length - next.length,
  };
}

function upsertDebtsInList(debts: DebtWithRelations[], incoming: DebtWithRelations[]) {
  if (incoming.length === 0) {
    return {
      items: debts,
      totalAdjustment: 0,
    };
  }

  const existingById = new Map(debts.map((debt) => [debt.id, debt]));
  const addedIds = new Set<string>();

  for (const debt of incoming) {
    if (!existingById.has(debt.id)) {
      addedIds.add(debt.id);
    }

    existingById.set(debt.id, debt);
  }

  const next = [...existingById.values()];
  next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    items: next,
    totalAdjustment: addedIds.size,
  };
}

function removeTransactionsFromList(
  transactions: CombinedTransaction[],
  transactionIds: Set<string>
): { items: CombinedTransaction[]; totalAdjustment: number } {
  if (transactionIds.size === 0) {
    return { items: transactions, totalAdjustment: 0 };
  }

  const next = transactions.filter((tx) => !transactionIds.has(tx.data.id));

  return {
    items: next,
    totalAdjustment: transactions.length - next.length,
  };
}

function upsertTransactionsInList(
  transactions: CombinedTransaction[],
  incoming: CombinedTransaction[]
): { items: CombinedTransaction[]; totalAdjustment: number } {
  if (incoming.length === 0) {
    return { items: transactions, totalAdjustment: 0 };
  }

  const existingById = new Map(transactions.map((tx) => [tx.data.id, tx]));
  const addedIds = new Set<string>();

  for (const tx of incoming) {
    if (!existingById.has(tx.data.id)) {
      addedIds.add(tx.data.id);
    }

    existingById.set(tx.data.id, tx);
  }

  const next = [...existingById.values()];
  next.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  return {
    items: next,
    totalAdjustment: addedIds.size,
  };
}

function withUpdatedTotal(total: unknown, adjustment: number): number | undefined {
  if (typeof total !== "number") {
    return undefined;
  }

  return Math.max(total + adjustment, 0);
}

export function createWorkspaceOptimisticContext(
  queryClient: QueryClient,
  workspaceId: string,
  domains: WorkspaceOptimisticDomain[]
): WorkspaceOptimisticContext {
  return {
    queryClient,
    workspaceId,
    domains: normalizeDomains(domains),
    snapshots: [],
  };
}

export async function snapshotWorkspaceQueries(context: WorkspaceOptimisticContext): Promise<void> {
  const queryKeys = normalizeDomains(context.domains).map(
    (domain) => toWorkspaceQueryKeys(context.workspaceId)[domain]
  );

  await Promise.all(
    queryKeys.map((queryKey) => context.queryClient.cancelQueries({ queryKey, exact: false, type: "all" }))
  );

  const snapshots = queryKeys.flatMap((queryKey) => context.queryClient.getQueriesData({ queryKey }));

  context.snapshots = snapshots.map(([queryKey, data]) => ({
    queryKey,
    data,
  }));
}

export function rollbackWorkspaceSnapshot(context: WorkspaceOptimisticContext): void {
  for (const { queryKey, data } of context.snapshots) {
    context.queryClient.setQueryData(queryKey, data);
  }
}

export async function invalidateOptimisticWorkspaceDomains(context: WorkspaceOptimisticContext): Promise<void> {
  const queryClient = context.queryClient;
  const workspaceId = context.workspaceId;

  const promises = normalizeDomains(context.domains).map((domain) => {
    const queryKey = toWorkspaceQueryKeys(workspaceId)[domain];
    return queryClient.invalidateQueries({ queryKey });
  });

  await Promise.all(promises);
}

function isActionErrorResult(result: unknown): result is { error: string } {
  return result !== null && typeof result === "object" && "error" in result;
}

export async function runOptimisticWorkspaceMutation<TResult>({
  queryClient,
  workspaceId,
  domains,
  apply,
  mutation,
}: OptimisticWorkspaceMutationOptions<TResult>): Promise<TResult> {
  const context = createWorkspaceOptimisticContext(queryClient, workspaceId, domains);

  await snapshotWorkspaceQueries(context);
  await apply?.(context);

  try {
    const result = await mutation();

    if (isActionErrorResult(result)) {
      rollbackWorkspaceSnapshot(context);
    }

    return result;
  } catch (error) {
    rollbackWorkspaceSnapshot(context);
    throw error;
  } finally {
    await invalidateOptimisticWorkspaceDomains(context);
  }
}

export function updateAccountBalancesInCache(
  context: WorkspaceOptimisticContext,
  deltas: OptimisticBalanceDeltas
): void {
  const balanceDeltaById = normalizeBalanceDeltas(deltas);
  if (balanceDeltaById.size === 0 || context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context)) {
    const queryDomain = getQueryDomain(queryKey, context.workspaceId);

    if (queryDomain === "accounts") {
      context.queryClient.setQueryData(queryKey, (data: unknown) =>
        mapQueryListData<AccountWithBalance>(data, (items) => ({
          items: updateAccountsInList(items, balanceDeltaById),
        }))
      );
      continue;
    }

    if (queryDomain === "transactions") {
      context.queryClient.setQueryData(queryKey, (data: unknown) =>
        mapQueryListData<CombinedTransaction>(data, (transactions) => {
          let didChange = false;
          const next = transactions.map((transaction) => {
            const nextTransaction = updateAccountBalanceInTransaction(transaction, balanceDeltaById);
            if (nextTransaction !== transaction) {
              didChange = true;
            }
            return nextTransaction;
          });

          return { items: didChange ? next : transactions };
        })
      );
      continue;
    }

    if (queryDomain === "debts") {
    }
  }
}

export function updateDebtsInCache(context: WorkspaceOptimisticContext, updates: DebtPatch[]): void {
  if (updates.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const patchById = new Map<string, DebtPatch>(updates.map((item) => [item.id, item]));

  for (const { queryKey } of getSnapshotsForDomains(context, ["debts"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<DebtWithRelations>(data, (debts) => {
        const next = updateDebtsInList(debts, patchById);
        return {
          items: next,
          total: undefined,
        };
      })
    );
  }
}

export function removeDebtsFromCache(context: WorkspaceOptimisticContext, debtIds: string[]): void {
  if (debtIds.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const debtIdSet = new Set(debtIds);

  for (const { queryKey } of getSnapshotsForDomains(context, ["debts"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<DebtWithRelations>(data, (debts) => {
        const { items, totalAdjustment } = removeDebtsFromList(debts, debtIdSet);

        if (items === debts) {
          return { items: debts, total: undefined };
        }

        const next = withUpdatedTotal((data as { data: DebtWithRelations[]; total?: number })?.total, -totalAdjustment);

        return {
          items,
          total: next,
        };
      })
    );
  }
}

export function insertDebtsInCache(context: WorkspaceOptimisticContext, debts: DebtWithRelations[]): void {
  if (debts.length === 0 || context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["debts"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<DebtWithRelations>(data, (existingDebts) => {
        const { items, totalAdjustment } = upsertDebtsInList(existingDebts, debts);
        if (items === existingDebts) {
          return { items: existingDebts, total: undefined };
        }

        const next = withUpdatedTotal((data as { data: DebtWithRelations[]; total?: number })?.total, totalAdjustment);

        return {
          items,
          total: next,
        };
      })
    );
  }
}

export function removeTransactionsFromCache(context: WorkspaceOptimisticContext, transactionIds: string[]): void {
  if (transactionIds.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const transactionIdSet = new Set(transactionIds);

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (transactions) => {
        const { items, totalAdjustment } = removeTransactionsFromList(transactions, transactionIdSet);

        if (items === transactions) {
          return { items: transactions, total: undefined };
        }

        const next = withUpdatedTotal(
          (data as { data: CombinedTransaction[]; total?: number })?.total,
          -totalAdjustment
        );

        return {
          items,
          total: next,
        };
      })
    );
  }
}

export function insertTransactionsInCache(
  context: WorkspaceOptimisticContext,
  transactions: CombinedTransaction[]
): void {
  if (transactions.length === 0 || context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (existingTransactions) => {
        const { items, totalAdjustment } = upsertTransactionsInList(existingTransactions, transactions);
        if (items === existingTransactions) {
          return { items: existingTransactions, total: undefined };
        }

        const next = withUpdatedTotal(
          (data as { data: CombinedTransaction[]; total?: number })?.total,
          totalAdjustment
        );

        return {
          items,
          total: next,
        };
      })
    );
  }
}
