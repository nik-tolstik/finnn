import type { Account, UserReference } from "@/modules/accounts/account.types";
import { CURRENCY_OPTIONS, type Currency } from "@/shared/constants/currency";
import type { MoneyAmount, MoneyInput } from "@/shared/lib/domain-types";
import { compareMoney, divideMoney, multiplyMoney } from "@/shared/utils/money";

export type AccountDisplaySort = "custom" | "name" | "balance";
export type AccountDisplayDirection = "asc" | "desc";
export type AccountDisplayGrouping = "none" | "owner" | "currency";

export type AccountDisplayAccount = Account & {
  owner?: UserReference | null;
};

export type AccountExchangeRates = Readonly<Partial<Record<Currency, MoneyInput>>>;

export interface AccountDisplayGroup<TAccount extends AccountDisplayAccount = AccountDisplayAccount> {
  accounts: TAccount[];
  count: number;
  currency: string | null;
  id: string;
  label: string | null;
  owner: UserReference | null;
}

export interface AccountDisplayModel<TAccount extends AccountDisplayAccount = AccountDisplayAccount> {
  accounts: TAccount[];
  groups: AccountDisplayGroup<TAccount>[];
  manualAccounts: TAccount[];
  ratesAvailable: boolean;
}

export interface GetAccountDisplayModelInput<TAccount extends AccountDisplayAccount = AccountDisplayAccount> {
  accounts: readonly TAccount[];
  baseCurrency: Currency;
  direction: AccountDisplayDirection;
  exchangeRates?: AccountExchangeRates | null;
  grouping: AccountDisplayGrouping;
  sort: AccountDisplaySort;
  viewerUserId?: string | null;
}

const nameCollator = new Intl.Collator("ru", {
  numeric: true,
  sensitivity: "base",
});

function getCreatedAtTimestamp(account: AccountDisplayAccount) {
  const timestamp = new Date(account.createdAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function compareManualAccounts(a: AccountDisplayAccount, b: AccountDisplayAccount) {
  if (a.order !== b.order) {
    return a.order - b.order;
  }

  const aCreatedAt = getCreatedAtTimestamp(a);
  const bCreatedAt = getCreatedAtTimestamp(b);
  if (aCreatedAt !== bCreatedAt) {
    return bCreatedAt - aCreatedAt;
  }

  return a.id.localeCompare(b.id);
}

function getOwnerId(account: AccountDisplayAccount) {
  return account.owner?.id ?? account.ownerId ?? "__shared__";
}

function getOwnerLabel(owner: UserReference | null) {
  return owner?.name || owner?.email || "Общие";
}

function getOwnerSortLabel(owner: UserReference | null) {
  return owner?.name || owner?.email || "";
}

function getRate(exchangeRates: AccountExchangeRates | null | undefined, currency: string) {
  if (!exchangeRates || !(currency in exchangeRates)) {
    return null;
  }

  const rate = exchangeRates[currency as Currency];

  if (rate === undefined || rate === null) {
    return null;
  }

  try {
    return compareMoney(rate, "0") > 0 ? rate : null;
  } catch {
    return null;
  }
}

function getCurrencyOrder(currency: string) {
  const index = CURRENCY_OPTIONS.findIndex((option) => option.value === currency);

  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function compareWithManualFallback<TAccount extends AccountDisplayAccount>(
  manualIndexes: ReadonlyMap<string, number>,
  compare: (a: TAccount, b: TAccount) => number
) {
  return (a: TAccount, b: TAccount) => {
    const result = compare(a, b);

    if (result !== 0) {
      return result;
    }

    return (manualIndexes.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (manualIndexes.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  };
}

function groupAccountsByOwner<TAccount extends AccountDisplayAccount>(
  accounts: readonly TAccount[],
  viewerUserId?: string | null
) {
  const groups = new Map<string, AccountDisplayGroup<TAccount>>();

  for (const account of accounts) {
    const owner = account.owner ?? null;
    const ownerId = getOwnerId(account);
    const existingGroup = groups.get(ownerId);

    if (existingGroup) {
      existingGroup.accounts.push(account);
      existingGroup.count += 1;
      continue;
    }

    groups.set(ownerId, {
      accounts: [account],
      count: 1,
      currency: null,
      id: `owner:${ownerId}`,
      label: getOwnerLabel(owner),
      owner,
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aIsShared = a.owner === null;
    const bIsShared = b.owner === null;
    const aIsViewer = a.owner?.id === viewerUserId;
    const bIsViewer = b.owner?.id === viewerUserId;

    if (aIsViewer !== bIsViewer) {
      return aIsViewer ? -1 : 1;
    }

    if (aIsShared !== bIsShared) {
      return aIsShared ? 1 : -1;
    }

    const nameDifference = nameCollator.compare(getOwnerSortLabel(a.owner), getOwnerSortLabel(b.owner));
    if (nameDifference !== 0) {
      return nameDifference;
    }

    return a.id.localeCompare(b.id);
  });
}

function groupAccountsByCurrency<TAccount extends AccountDisplayAccount>(accounts: readonly TAccount[]) {
  const groups = new Map<string, AccountDisplayGroup<TAccount>>();

  for (const account of accounts) {
    const existingGroup = groups.get(account.currency);

    if (existingGroup) {
      existingGroup.accounts.push(account);
      existingGroup.count += 1;
      continue;
    }

    groups.set(account.currency, {
      accounts: [account],
      count: 1,
      currency: account.currency,
      id: `currency:${account.currency}`,
      label: account.currency,
      owner: null,
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aOrder = getCurrencyOrder(a.currency ?? "");
    const bOrder = getCurrencyOrder(b.currency ?? "");
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return nameCollator.compare(a.currency ?? "", b.currency ?? "");
  });
}

/**
 * Returns the persisted manual order without changing the source array. Duplicate ranks are
 * resolved by newer creation dates and then account id so every display has a deterministic order.
 */
export function getCanonicalAccountOrder<TAccount extends AccountDisplayAccount>(accounts: readonly TAccount[]) {
  return [...accounts].sort(compareManualAccounts);
}

/**
 * Converts an account balance to the workspace base currency from rates expressed relative to BYN.
 * It returns null instead of approximating when either rate is missing or invalid.
 */
export function getConvertedBalance(
  account: AccountDisplayAccount,
  baseCurrency: Currency,
  exchangeRates?: AccountExchangeRates | null
): MoneyAmount | null {
  const fromRate = getRate(exchangeRates, account.currency);
  const baseRate = getRate(exchangeRates, baseCurrency);

  if (fromRate === null || baseRate === null) {
    return null;
  }

  try {
    return divideMoney(multiplyMoney(account.balance, fromRate), baseRate);
  } catch {
    return null;
  }
}

/**
 * Builds a non-mutating account view. Balance sorting is intentionally all-or-nothing: if one
 * visible account cannot be converted, the canonical manual order is retained.
 */
export function getAccountDisplayModel<TAccount extends AccountDisplayAccount>(
  input: GetAccountDisplayModelInput<TAccount>
): AccountDisplayModel<TAccount> {
  const manualAccounts = getCanonicalAccountOrder(input.accounts);
  const manualIndexes = new Map(manualAccounts.map((account, index) => [account.id, index]));
  const convertedBalances = new Map<string, MoneyAmount>();
  let ratesAvailable = true;

  if (input.sort === "balance") {
    for (const account of manualAccounts) {
      const convertedBalance = getConvertedBalance(account, input.baseCurrency, input.exchangeRates);

      if (convertedBalance === null) {
        ratesAvailable = false;
        break;
      }

      convertedBalances.set(account.id, convertedBalance);
    }
  }

  let accounts = manualAccounts;

  if (input.sort === "name") {
    const direction = input.direction === "asc" ? 1 : -1;
    accounts = [...manualAccounts].sort(
      compareWithManualFallback(manualIndexes, (a, b) => direction * nameCollator.compare(a.name, b.name))
    );
  }

  if (input.sort === "balance" && ratesAvailable) {
    const direction = input.direction === "asc" ? 1 : -1;
    accounts = [...manualAccounts].sort(
      compareWithManualFallback(manualIndexes, (a, b) => {
        const aBalance = convertedBalances.get(a.id);
        const bBalance = convertedBalances.get(b.id);

        if (aBalance === undefined || bBalance === undefined) {
          return 0;
        }

        return direction * compareMoney(aBalance, bBalance);
      })
    );
  }

  const groups =
    input.grouping === "owner"
      ? groupAccountsByOwner(accounts, input.viewerUserId)
      : input.grouping === "currency"
        ? groupAccountsByCurrency(accounts)
        : [
            {
              accounts,
              count: accounts.length,
              currency: null,
              id: "all",
              label: null,
              owner: null,
            },
          ];

  return {
    accounts,
    groups,
    manualAccounts,
    ratesAvailable,
  };
}

/**
 * Applies a reordered visible subset at its canonical positions in the full active account list.
 * Accounts outside the visible subset retain their slots, and the input arrays stay untouched.
 */
export function mergeReorderedVisibleAccounts<TAccount extends AccountDisplayAccount>(
  fullAccounts: readonly TAccount[],
  reorderedVisibleAccounts: readonly TAccount[]
) {
  const canonicalAccounts = getCanonicalAccountOrder(fullAccounts);
  const accountById = new Map(canonicalAccounts.map((account) => [account.id, account]));
  const reorderedVisible: TAccount[] = [];
  const visibleIds = new Set<string>();

  for (const account of reorderedVisibleAccounts) {
    if (!accountById.has(account.id) || visibleIds.has(account.id)) {
      continue;
    }

    visibleIds.add(account.id);
    reorderedVisible.push(account);
  }

  let visibleIndex = 0;

  return canonicalAccounts.map((account) => {
    if (!visibleIds.has(account.id)) {
      return account;
    }

    const reorderedAccount = reorderedVisible[visibleIndex];
    visibleIndex += 1;

    return reorderedAccount ?? account;
  });
}
