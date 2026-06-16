import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { Account, AccountWithBalance } from "@/modules/accounts/account.types";
import type { Category } from "@/modules/categories/category.types";
import type { DebtWithRelations } from "@/modules/debts/debt.types";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import type { TransactionListFilters } from "@/modules/transactions/transaction-filter.types";
import { filterCombinedTransactions } from "@/modules/transactions/utils/combined-transaction-filtering";
import type { WorkspaceSummary, WorkspaceWithOwner } from "@/modules/workspace/workspace.types";
import {
  accountKeys,
  categoryKeys,
  debtKeys,
  transactionKeys,
  workspaceKeys,
  workspacesKeys,
} from "@/shared/lib/query-keys";
import { addMoney } from "@/shared/utils/money";

export type WorkspaceOptimisticDomain =
  | "workspaces"
  | "workspaceSummary"
  | "workspaceMembers"
  | "accounts"
  | "archivedAccounts"
  | "categories"
  | "transactions"
  | "debts";

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

export type AccountPatch = Pick<Account, "id"> & Partial<Account>;
export type CategoryPatch = Pick<Category, "id"> & Partial<Category>;
export type DebtPatch = Pick<DebtWithRelations, "id"> & Partial<Omit<DebtWithRelations, "id">>;
export type WorkspacePatch = Pick<WorkspaceSummary, "id"> & Partial<WorkspaceSummary>;
export type UserReferencePatch = {
  id: string;
  name?: string | null;
  image?: string | null;
  email?: string;
};

export interface OptimisticWorkspaceMutationOptions<TResult> {
  queryClient: QueryClient;
  workspaceId: string;
  domains: WorkspaceOptimisticDomain[];
  apply?: (context: WorkspaceOptimisticContext) => void | Promise<void>;
  onApplied?: (context: WorkspaceOptimisticContext) => void | Promise<void>;
  mutation: () => Promise<TResult>;
}

function toWorkspaceQueryKeys(workspaceId: string) {
  return {
    workspaces: workspacesKeys.list(),
    workspaceSummary: workspaceKeys.summary(workspaceId),
    workspaceMembers: workspaceKeys.members(workspaceId),
    accounts: accountKeys.all(workspaceId),
    archivedAccounts: accountKeys.archived(workspaceId),
    categories: categoryKeys.all(workspaceId),
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
  if (!Array.isArray(queryKey) || queryKey.length < 1) {
    return null;
  }

  const [domain, workspace] = queryKey;

  if (domain === "workspaces") {
    return "workspaces";
  }

  if (domain === "workspace" && workspace === workspaceId) {
    if (queryKey[2] === "summary") {
      return "workspaceSummary";
    }

    if (queryKey[2] === "members") {
      return "workspaceMembers";
    }

    return null;
  }

  if (workspace !== workspaceId || typeof domain !== "string") {
    return null;
  }

  if (domain === "accounts" && queryKey[2] === "archived") {
    return "archivedAccounts";
  }

  if (domain === "accounts" || domain === "transactions" || domain === "debts") {
    return domain;
  }

  if (domain === "categories") {
    return "categories";
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

function mapQueryObjectData<TData extends object>(data: unknown, updater: (payload: TData) => TData): unknown {
  if (!data || typeof data !== "object" || !("data" in data)) {
    return data;
  }

  const rawPayload = data as { data: unknown };
  if (!rawPayload.data || typeof rawPayload.data !== "object" || Array.isArray(rawPayload.data)) {
    return data;
  }

  const next = updater(rawPayload.data as TData);
  if (next === rawPayload.data) {
    return data;
  }

  return {
    ...rawPayload,
    data: next,
  };
}

function hasId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string");
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

function patchAccount<TAccount>(account: TAccount, patchById: Map<string, AccountPatch>): TAccount {
  if (!hasId(account)) {
    return account;
  }

  const patch = patchById.get(account.id);
  if (!patch) {
    return account;
  }

  return {
    ...account,
    ...patch,
    id: account.id,
  };
}

function patchUserReference<TUser>(user: TUser, patchById: Map<string, UserReferencePatch>): TUser {
  if (!hasId(user)) {
    return user;
  }

  const patch = patchById.get(user.id);
  if (!patch) {
    return user;
  }

  return {
    ...user,
    ...patch,
    id: user.id,
  };
}

function patchUserReferencesDeep(value: unknown, patchById: Map<string, UserReferencePatch>): unknown {
  if (!value || typeof value !== "object" || value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    let didChange = false;
    const next = value.map((item) => {
      const nextItem = patchUserReferencesDeep(item, patchById);
      if (nextItem !== item) {
        didChange = true;
      }
      return nextItem;
    });

    return didChange ? next : value;
  }

  let didChange = false;
  const source = hasId(value) && patchById.has(value.id) ? { ...value, ...patchById.get(value.id) } : value;
  didChange = source !== value;

  const next: Record<string, unknown> = { ...(source as Record<string, unknown>) };
  for (const [key, item] of Object.entries(source as Record<string, unknown>)) {
    const nextItem = patchUserReferencesDeep(item, patchById);
    if (nextItem !== item) {
      next[key] = nextItem;
      didChange = true;
    }
  }

  return didChange ? next : value;
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

function updateAccountInTransaction(
  transaction: CombinedTransaction,
  patchById: Map<string, AccountPatch>
): CombinedTransaction {
  if (transaction.kind === "paymentTransaction") {
    const nextAccount = patchAccount(transaction.data.account, patchById);
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
    const nextFromAccount = patchAccount(transaction.data.fromAccount, patchById);
    const nextToAccount = patchAccount(transaction.data.toAccount, patchById);
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

  const nextAccount = transaction.data.account
    ? patchAccount(transaction.data.account, patchById)
    : transaction.data.account;
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

function updateUserReferenceInTransaction(
  transaction: CombinedTransaction,
  patchById: Map<string, UserReferencePatch>
): CombinedTransaction {
  if (transaction.kind === "paymentTransaction") {
    const nextOwner = transaction.data.account.owner
      ? patchUserReference(transaction.data.account.owner, patchById)
      : transaction.data.account.owner;
    if (nextOwner === transaction.data.account.owner) {
      return transaction;
    }

    return {
      ...transaction,
      data: {
        ...transaction.data,
        account: {
          ...transaction.data.account,
          owner: nextOwner,
        },
      },
    };
  }

  if (transaction.kind === "transferTransaction") {
    const nextCreatedBy = transaction.data.createdBy
      ? patchUserReference(transaction.data.createdBy, patchById)
      : transaction.data.createdBy;
    const nextFromOwner = transaction.data.fromAccount.owner
      ? patchUserReference(transaction.data.fromAccount.owner, patchById)
      : transaction.data.fromAccount.owner;
    const nextToOwner = transaction.data.toAccount.owner
      ? patchUserReference(transaction.data.toAccount.owner, patchById)
      : transaction.data.toAccount.owner;
    if (
      nextCreatedBy === transaction.data.createdBy &&
      nextFromOwner === transaction.data.fromAccount.owner &&
      nextToOwner === transaction.data.toAccount.owner
    ) {
      return transaction;
    }

    return {
      ...transaction,
      data: {
        ...transaction.data,
        createdBy: nextCreatedBy,
        fromAccount: {
          ...transaction.data.fromAccount,
          owner: nextFromOwner,
        },
        toAccount: {
          ...transaction.data.toAccount,
          owner: nextToOwner,
        },
      },
    };
  }

  const nextOwner = transaction.data.account?.owner
    ? patchUserReference(transaction.data.account.owner, patchById)
    : transaction.data.account?.owner;
  if (nextOwner === transaction.data.account?.owner) {
    return transaction;
  }

  return {
    ...transaction,
    data: {
      ...transaction.data,
      account: transaction.data.account
        ? {
            ...transaction.data.account,
            owner: nextOwner ?? null,
          }
        : transaction.data.account,
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

function patchAccountsInList<TAccount extends { id: string }>(
  accounts: TAccount[],
  patchById: Map<string, AccountPatch>
): TAccount[] {
  let didChange = false;

  const next = accounts.map((account) => {
    const nextAccount = patchAccount(account, patchById);
    if (nextAccount !== account) {
      didChange = true;
    }
    return nextAccount as TAccount;
  });

  return didChange ? next : accounts;
}

function upsertAccountsInList<TAccount extends { id: string; order?: number | null; createdAt?: Date | string }>(
  accounts: TAccount[],
  incoming: TAccount[]
) {
  if (incoming.length === 0) {
    return { items: accounts, totalAdjustment: 0 };
  }

  const existingById = new Map(accounts.map((account) => [account.id, account]));
  const addedIds = new Set<string>();

  for (const account of incoming) {
    if (!existingById.has(account.id)) {
      addedIds.add(account.id);
    }
    existingById.set(account.id, account);
  }

  const next = [...existingById.values()];
  next.sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  return {
    items: next,
    totalAdjustment: addedIds.size,
  };
}

function removeAccountsFromList<TAccount extends { id: string }>(accounts: TAccount[], accountIds: Set<string>) {
  if (accountIds.size === 0) {
    return { items: accounts, removed: [] as TAccount[], totalAdjustment: 0 };
  }

  const removed: TAccount[] = [];
  const next = accounts.filter((account) => {
    if (!accountIds.has(account.id)) {
      return true;
    }

    removed.push(account);
    return false;
  });

  return {
    items: next,
    removed,
    totalAdjustment: accounts.length - next.length,
  };
}

function patchCategoryInTransaction(
  transaction: CombinedTransaction,
  patchById: Map<string, CategoryPatch>,
  removedIds?: Set<string>
): CombinedTransaction {
  if (transaction.kind !== "paymentTransaction" || !transaction.data.category) {
    return transaction;
  }

  if (removedIds?.has(transaction.data.category.id)) {
    return {
      ...transaction,
      data: {
        ...transaction.data,
        category: null,
        categoryId: null,
      },
    };
  }

  const patch = patchById.get(transaction.data.category.id);
  if (!patch) {
    return transaction;
  }

  return {
    ...transaction,
    data: {
      ...transaction.data,
      category: {
        ...transaction.data.category,
        ...patch,
        id: transaction.data.category.id,
      },
    },
  };
}

function upsertCategoriesInList<TCategory extends { id: string; type?: string; order?: number | null; name?: string }>(
  categories: TCategory[],
  incoming: TCategory[]
) {
  if (incoming.length === 0) {
    return { items: categories, totalAdjustment: 0 };
  }

  const existingById = new Map(categories.map((category) => [category.id, category]));
  const addedIds = new Set<string>();

  for (const category of incoming) {
    if (!existingById.has(category.id)) {
      addedIds.add(category.id);
    }
    existingById.set(category.id, category);
  }

  const next = [...existingById.values()];
  next.sort((a, b) => {
    if ((a.type ?? "") !== (b.type ?? "")) {
      return (a.type ?? "").localeCompare(b.type ?? "");
    }

    const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return {
    items: next,
    totalAdjustment: addedIds.size,
  };
}

function patchCategoriesInList<TCategory extends { id: string }>(
  categories: TCategory[],
  patchById: Map<string, CategoryPatch>
): TCategory[] {
  let didChange = false;

  const next = categories.map((category) => {
    const patch = patchById.get(category.id);
    if (!patch) {
      return category;
    }

    didChange = true;
    return {
      ...category,
      ...patch,
      id: category.id,
    };
  });

  return didChange ? next : categories;
}

function removeCategoriesFromList<TCategory extends { id: string }>(categories: TCategory[], categoryIds: Set<string>) {
  if (categoryIds.size === 0) {
    return { items: categories, totalAdjustment: 0 };
  }

  const next = categories.filter((category) => !categoryIds.has(category.id));

  return {
    items: next,
    totalAdjustment: categories.length - next.length,
  };
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

function getTransactionFiltersFromQueryKey(queryKey: QueryKey): TransactionListFilters | undefined {
  if (!Array.isArray(queryKey) || queryKey[0] !== "transactions") {
    return undefined;
  }

  const filters = queryKey[2];
  return filters && typeof filters === "object" && !Array.isArray(filters)
    ? (filters as TransactionListFilters)
    : undefined;
}

function shouldInsertTransactionIntoQuery(transaction: CombinedTransaction, queryKey: QueryKey) {
  const filters = getTransactionFiltersFromQueryKey(queryKey);
  if ((filters?.skip ?? 0) > 0) {
    return false;
  }

  if (transaction.kind === "debtTransaction" && filters?.includeDebtTransactions === false) {
    return false;
  }

  return filterCombinedTransactions([transaction], filters).length > 0;
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
  onApplied,
  mutation,
}: OptimisticWorkspaceMutationOptions<TResult>): Promise<TResult> {
  const context = createWorkspaceOptimisticContext(queryClient, workspaceId, domains);

  await snapshotWorkspaceQueries(context);
  await apply?.(context);
  await onApplied?.(context);

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
    }
  }
}

export function insertAccountsInCache(context: WorkspaceOptimisticContext, accounts: Account[]): void {
  if (accounts.length === 0 || context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["accounts"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Account>(data, (existingAccounts) => {
        const { items, totalAdjustment } = upsertAccountsInList(existingAccounts, accounts);
        if (items === existingAccounts) {
          return { items: existingAccounts, total: undefined };
        }

        const next = withUpdatedTotal((data as { data: Account[]; total?: number })?.total, totalAdjustment);
        return { items, total: next };
      })
    );
  }
}

export function updateAccountsInCache(context: WorkspaceOptimisticContext, updates: AccountPatch[]): void {
  if (updates.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const patchById = new Map<string, AccountPatch>(updates.map((item) => [item.id, item]));

  for (const { queryKey } of getSnapshotsForDomains(context, ["accounts", "archivedAccounts"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Account>(data, (accounts) => ({
        items: patchAccountsInList(accounts, patchById),
        total: undefined,
      }))
    );
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (transactions) => {
        let didChange = false;
        const next = transactions.map((transaction) => {
          const nextTransaction = updateAccountInTransaction(transaction, patchById);
          if (nextTransaction !== transaction) {
            didChange = true;
          }
          return nextTransaction;
        });

        return { items: didChange ? next : transactions };
      })
    );
  }
}

export function removeAccountsInCache(
  context: WorkspaceOptimisticContext,
  accountIds: string[],
  domains: WorkspaceOptimisticDomain[] = ["accounts", "archivedAccounts"]
): Account[] {
  if (accountIds.length === 0 || context.snapshots.length === 0) {
    return [];
  }

  const accountIdSet = new Set(accountIds);
  const removedAccounts: Account[] = [];

  for (const { queryKey } of getSnapshotsForDomains(context, domains)) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Account>(data, (accounts) => {
        const { items, removed, totalAdjustment } = removeAccountsFromList(accounts, accountIdSet);
        removedAccounts.push(...removed);
        if (items === accounts) {
          return { items: accounts, total: undefined };
        }

        const next = withUpdatedTotal((data as { data: Account[]; total?: number })?.total, -totalAdjustment);
        return { items, total: next };
      })
    );
  }

  return removedAccounts;
}

export const removeAccountsFromCache = removeAccountsInCache;

export function moveAccountArchiveStateInCache(
  context: WorkspaceOptimisticContext,
  account: Account,
  archived: boolean
): void {
  const nextAccount = { ...account, archived };

  if (archived) {
    removeAccountsFromCache(context, [account.id], ["accounts"]);
    for (const { queryKey } of getSnapshotsForDomains(context, ["archivedAccounts"])) {
      context.queryClient.setQueryData(queryKey, (data: unknown) =>
        mapQueryListData<Account>(data, (accounts) => {
          const { items, totalAdjustment } = upsertAccountsInList(accounts, [nextAccount]);
          const next = withUpdatedTotal((data as { data: Account[]; total?: number })?.total, totalAdjustment);
          return { items, total: next };
        })
      );
    }
    return;
  }

  removeAccountsFromCache(context, [account.id], ["archivedAccounts"]);
  insertAccountsInCache(context, [nextAccount]);
}

export function insertCategoriesInCache(context: WorkspaceOptimisticContext, categories: Category[]): void {
  if (categories.length === 0 || context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["categories"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Category>(data, (existingCategories) => {
        const { items, totalAdjustment } = upsertCategoriesInList(existingCategories, categories);
        const next = withUpdatedTotal((data as { data: Category[]; total?: number })?.total, totalAdjustment);
        return { items, total: next };
      })
    );
  }
}

export function updateCategoriesInCache(context: WorkspaceOptimisticContext, updates: CategoryPatch[]): void {
  if (updates.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const patchById = new Map<string, CategoryPatch>(updates.map((item) => [item.id, item]));

  for (const { queryKey } of getSnapshotsForDomains(context, ["categories"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Category>(data, (categories) => ({
        items: patchCategoriesInList(categories, patchById),
      }))
    );
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (transactions) => {
        let didChange = false;
        const next = transactions.map((transaction) => {
          const nextTransaction = patchCategoryInTransaction(transaction, patchById);
          if (nextTransaction !== transaction) {
            didChange = true;
          }
          return nextTransaction;
        });

        return { items: didChange ? next : transactions };
      })
    );
  }
}

export function removeCategoriesInCache(context: WorkspaceOptimisticContext, categoryIds: string[]): void {
  if (categoryIds.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const categoryIdSet = new Set(categoryIds);

  for (const { queryKey } of getSnapshotsForDomains(context, ["categories"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Category>(data, (categories) => {
        const { items, totalAdjustment } = removeCategoriesFromList(categories, categoryIdSet);
        const next = withUpdatedTotal((data as { data: Category[]; total?: number })?.total, -totalAdjustment);
        return { items, total: next };
      })
    );
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (transactions) => {
        let didChange = false;
        const next = transactions.map((transaction) => {
          const nextTransaction = patchCategoryInTransaction(transaction, new Map(), categoryIdSet);
          if (nextTransaction !== transaction) {
            didChange = true;
          }
          return nextTransaction;
        });

        return { items: didChange ? next : transactions };
      })
    );
  }
}

export const removeCategoriesFromCache = removeCategoriesInCache;

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
        const matchingTransactions = transactions.filter((transaction) =>
          shouldInsertTransactionIntoQuery(transaction, queryKey)
        );
        const { items, totalAdjustment } = upsertTransactionsInList(existingTransactions, matchingTransactions);
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

export function updateTransactionsInCache(
  context: WorkspaceOptimisticContext,
  transactions: CombinedTransaction[]
): void {
  if (transactions.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const incomingById = new Map(transactions.map((transaction) => [transaction.data.id, transaction]));

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (existingTransactions) => {
        let totalAdjustment = 0;
        const seenIds = new Set<string>();
        const nextTransactions: CombinedTransaction[] = [];

        for (const transaction of existingTransactions) {
          const incoming = incomingById.get(transaction.data.id);
          if (!incoming) {
            nextTransactions.push(transaction);
            continue;
          }

          seenIds.add(incoming.data.id);
          if (shouldInsertTransactionIntoQuery(incoming, queryKey)) {
            nextTransactions.push(incoming);
          } else {
            totalAdjustment -= 1;
          }
        }

        for (const transaction of transactions) {
          if (seenIds.has(transaction.data.id) || !shouldInsertTransactionIntoQuery(transaction, queryKey)) {
            continue;
          }

          nextTransactions.push(transaction);
          totalAdjustment += 1;
        }

        nextTransactions.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

        return {
          items: nextTransactions,
          total: withUpdatedTotal((data as { data: CombinedTransaction[]; total?: number })?.total, totalAdjustment),
        };
      })
    );
  }
}

export function updateWorkspaceCaches(context: WorkspaceOptimisticContext, patch: WorkspacePatch): void {
  if (context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["workspaceSummary"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryObjectData<WorkspaceSummary>(data, (workspace) =>
        workspace.id === patch.id
          ? {
              ...workspace,
              ...patch,
              id: workspace.id,
            }
          : workspace
      )
    );
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["workspaces"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<WorkspaceWithOwner>(data, (workspaces) => ({
        items: workspaces.map((workspace) =>
          workspace.id === patch.id
            ? {
                ...workspace,
                ...patch,
                id: workspace.id,
              }
            : workspace
        ),
      }))
    );
  }
}

export function insertWorkspacesInCache(context: WorkspaceOptimisticContext, workspaces: WorkspaceWithOwner[]): void {
  if (workspaces.length === 0 || context.snapshots.length === 0) {
    return;
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["workspaces"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<WorkspaceWithOwner>(data, (existingWorkspaces) => {
        const existingById = new Map(existingWorkspaces.map((workspace) => [workspace.id, workspace]));
        let added = 0;
        for (const workspace of workspaces) {
          if (!existingById.has(workspace.id)) {
            added += 1;
          }
          existingById.set(workspace.id, workspace);
        }

        const items = [...existingById.values()].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return {
          items,
          total: withUpdatedTotal((data as { data: WorkspaceWithOwner[]; total?: number })?.total, added),
        };
      })
    );
  }
}

export function removeWorkspacesInCache(context: WorkspaceOptimisticContext, workspaceIds: string[]): void {
  if (workspaceIds.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const workspaceIdSet = new Set(workspaceIds);

  for (const { queryKey } of getSnapshotsForDomains(context, ["workspaces"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<WorkspaceWithOwner>(data, (workspaces) => {
        const items = workspaces.filter((workspace) => !workspaceIdSet.has(workspace.id));
        return {
          items,
          total: withUpdatedTotal(
            (data as { data: WorkspaceWithOwner[]; total?: number })?.total,
            -(workspaces.length - items.length)
          ),
        };
      })
    );
  }
}

export const removeWorkspacesFromCache = removeWorkspacesInCache;

export function updateUserReferencesInCache(context: WorkspaceOptimisticContext, updates: UserReferencePatch[]): void {
  if (updates.length === 0 || context.snapshots.length === 0) {
    return;
  }

  const patchById = new Map(updates.map((update) => [update.id, update]));

  for (const { queryKey } of getSnapshotsForDomains(context, ["accounts", "archivedAccounts"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<Account & { owner?: UserReferencePatch | null }>(data, (accounts) => {
        let didChange = false;
        const next = accounts.map((account) => {
          const nextOwner = account.owner ? patchUserReference(account.owner, patchById) : account.owner;
          if (nextOwner === account.owner) {
            return account;
          }

          didChange = true;
          return {
            ...account,
            owner: nextOwner,
          };
        });

        return { items: didChange ? next : accounts };
      })
    );
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["transactions"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) =>
      mapQueryListData<CombinedTransaction>(data, (transactions) => {
        let didChange = false;
        const next = transactions.map((transaction) => {
          const nextTransaction = updateUserReferenceInTransaction(transaction, patchById);
          if (nextTransaction !== transaction) {
            didChange = true;
          }
          return nextTransaction;
        });

        return { items: didChange ? next : transactions };
      })
    );
  }

  for (const { queryKey } of getSnapshotsForDomains(context, ["workspaces", "workspaceMembers"])) {
    context.queryClient.setQueryData(queryKey, (data: unknown) => {
      if (!data || typeof data !== "object" || !("data" in data)) {
        return data;
      }

      return patchUserReferencesDeep(data, patchById);
    });
  }
}
