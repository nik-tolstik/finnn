import { describe, expect, it } from "vitest";

import type { UserReference } from "@/modules/accounts/account.types";
import { Currency } from "@/shared/constants/currency";

import {
  type AccountDisplayAccount,
  getAccountDisplayModel,
  getCanonicalAccountOrder,
  getConvertedBalance,
  mergeReorderedVisibleAccounts,
} from "./account-display";

const viewer: UserReference = {
  email: "viewer@example.com",
  id: "viewer",
  image: null,
  name: "Viewer",
};

function makeAccount(
  overrides: Partial<AccountDisplayAccount> & Pick<AccountDisplayAccount, "id">
): AccountDisplayAccount {
  const { id, ...rest } = overrides;

  return {
    archived: false,
    balance: "0",
    color: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    currency: Currency.BYN,
    description: null,
    icon: null,
    hidden: false,
    id,
    initialBalance: "0",
    name: overrides.id,
    order: 0,
    owner: null,
    ownerId: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    workspaceId: "workspace",
    ...rest,
  };
}

function getModel(accounts: readonly AccountDisplayAccount[], overrides = {}) {
  return getAccountDisplayModel({
    accounts,
    baseCurrency: Currency.BYN,
    direction: "asc",
    grouping: "none",
    sort: "custom",
    ...overrides,
  });
}

describe("getCanonicalAccountOrder", () => {
  it("orders by saved rank, then newest creation date, then id without mutating the input", () => {
    const accounts = [
      makeAccount({ id: "old", order: 2, createdAt: new Date("2026-01-01") }),
      makeAccount({ id: "first", order: 0, createdAt: new Date("2026-01-01") }),
      makeAccount({ id: "new", order: 2, createdAt: new Date("2026-02-01") }),
      makeAccount({ id: "b", order: 3, createdAt: new Date("2026-02-01") }),
      makeAccount({ id: "a", order: 3, createdAt: new Date("2026-02-01") }),
    ];
    const inputIds = accounts.map((account) => account.id);

    const ordered = getCanonicalAccountOrder(accounts);

    expect(ordered).toHaveLength(accounts.length);
    expect(ordered.map((account) => account.id)).toEqual(["first", "new", "old", "a", "b"]);
    expect(ordered).not.toBe(accounts);
    expect(accounts.map((account) => account.id)).toEqual(inputIds);
  });
});

describe("getAccountDisplayModel sorting", () => {
  it("sorts names in either direction and keeps equal names in canonical manual order", () => {
    const accounts = [
      makeAccount({ id: "beta", name: "Бета", order: 2 }),
      makeAccount({ id: "cash-second", name: "Cash", order: 1 }),
      makeAccount({ id: "alpha", name: "Альфа", order: 3 }),
      makeAccount({ id: "cash-first", name: "Cash", order: 0 }),
    ];

    const ascending = getModel(accounts, { sort: "name", direction: "asc" });
    const descending = getModel(accounts, { sort: "name", direction: "desc" });

    expect(ascending.accounts.map((account) => account.id)).toEqual(["alpha", "beta", "cash-first", "cash-second"]);
    expect(descending.accounts.map((account) => account.id)).toEqual(["cash-first", "cash-second", "beta", "alpha"]);
    expect(accounts.map((account) => account.id)).toEqual(["beta", "cash-second", "alpha", "cash-first"]);
  });

  it("converts balances through rate[from] divided by rate[base] before sorting", () => {
    const accounts = [
      makeAccount({ id: "usd", balance: "7", currency: Currency.USD, order: 2 }),
      makeAccount({ id: "byn", balance: "30", currency: Currency.BYN, order: 0 }),
      makeAccount({ id: "eur", balance: "6", currency: Currency.EUR, order: 1 }),
      makeAccount({ id: "negative", balance: "-3", currency: Currency.USD, order: 3 }),
    ];
    const exchangeRates = {
      [Currency.BYN]: 1,
      [Currency.EUR]: 4,
      [Currency.USD]: 3,
    };

    const model = getAccountDisplayModel({
      accounts,
      baseCurrency: Currency.USD,
      direction: "desc",
      exchangeRates,
      grouping: "none",
      sort: "balance",
    });
    const ascending = getAccountDisplayModel({
      accounts,
      baseCurrency: Currency.USD,
      direction: "asc",
      exchangeRates,
      grouping: "none",
      sort: "balance",
    });

    expect(getConvertedBalance(accounts[2], Currency.USD, exchangeRates)).toBe("8");
    expect(model.ratesAvailable).toBe(true);
    expect(model.accounts.map((account) => account.id)).toEqual(["byn", "eur", "usd", "negative"]);
    expect(ascending.accounts.map((account) => account.id)).toEqual(["negative", "usd", "eur", "byn"]);
  });

  it("uses canonical manual order when any balance cannot be converted", () => {
    const accounts = [
      makeAccount({ id: "manual-first", balance: "1", currency: Currency.USD, order: 0 }),
      makeAccount({ id: "manual-second", balance: "100", currency: Currency.BYN, order: 1 }),
    ];

    const model = getModel(accounts, {
      sort: "balance",
      direction: "desc",
      exchangeRates: { [Currency.USD]: 3 },
    });

    expect(getConvertedBalance(accounts[0], Currency.BYN, { [Currency.USD]: 3 })).toBeNull();
    expect(model.ratesAvailable).toBe(false);
    expect(model.accounts.map((account) => account.id)).toEqual(["manual-first", "manual-second"]);
  });

  it("uses manual order as the stable fallback for equal converted balances", () => {
    const accounts = [
      makeAccount({ id: "eur-first", balance: "3", currency: Currency.EUR, order: 0 }),
      makeAccount({ id: "usd-second", balance: "4", currency: Currency.USD, order: 1 }),
    ];

    const model = getModel(accounts, {
      sort: "balance",
      exchangeRates: {
        [Currency.BYN]: 1,
        [Currency.EUR]: 4,
        [Currency.USD]: 3,
      },
    });

    expect(model.accounts.map((account) => account.id)).toEqual(["eur-first", "usd-second"]);
  });
});

describe("getAccountDisplayModel grouping", () => {
  it("groups owners with the viewer first, named owners alphabetically, and shared accounts last", () => {
    const anna: UserReference = { email: "anna@example.com", id: "anna", image: null, name: null };
    const boris: UserReference = { email: "boris@example.com", id: "boris", image: null, name: "Zoe" };
    const accounts = [
      makeAccount({ id: "shared", order: 0 }),
      makeAccount({ id: "boris", order: 1, owner: boris, ownerId: boris.id }),
      makeAccount({ id: "anna", order: 2, owner: anna, ownerId: anna.id }),
      makeAccount({ id: "viewer", order: 3, owner: viewer, ownerId: viewer.id }),
      makeAccount({ id: "viewer-two", order: 4, owner: viewer, ownerId: viewer.id }),
    ];

    const model = getModel(accounts, { grouping: "owner", viewerUserId: viewer.id });

    expect(model.groups.map((group) => group.id)).toEqual([
      "owner:viewer",
      "owner:anna",
      "owner:boris",
      "owner:__shared__",
    ]);
    expect(model.groups[0]).toMatchObject({ count: 2, label: "Viewer", owner: viewer });
    expect(model.groups[0].accounts.map((account) => account.id)).toEqual(["viewer", "viewer-two"]);
    expect(model.groups[3]).toMatchObject({ count: 1, label: "Общие", owner: null });
  });

  it("groups currencies in the shared currency option order", () => {
    const accounts = [
      makeAccount({ id: "rub", currency: Currency.RUB, order: 0 }),
      makeAccount({ id: "usd", currency: Currency.USD, order: 1 }),
      makeAccount({ id: "byn", currency: Currency.BYN, order: 2 }),
      makeAccount({ id: "eur", currency: Currency.EUR, order: 3 }),
      makeAccount({ id: "usd-two", currency: Currency.USD, order: 4 }),
    ];

    const model = getModel(accounts, { grouping: "currency" });

    expect(model.groups.map((group) => group.currency)).toEqual([
      Currency.BYN,
      Currency.USD,
      Currency.EUR,
      Currency.RUB,
    ]);
    expect(model.groups.map((group) => group.count)).toEqual([1, 2, 1, 1]);
    expect(model.groups[1].accounts.map((account) => account.id)).toEqual(["usd", "usd-two"]);
  });

  it("returns one unlabelled group when grouping is disabled", () => {
    const model = getModel([makeAccount({ id: "account" })]);

    expect(model.groups).toEqual([
      expect.objectContaining({
        count: 1,
        currency: null,
        id: "all",
        label: null,
        owner: null,
      }),
    ]);
  });
});

describe("mergeReorderedVisibleAccounts", () => {
  it("replaces only visible slots in the canonical full list and leaves input arrays untouched", () => {
    const visibleFirst = makeAccount({ id: "visible-first", order: 0 });
    const hiddenFirst = makeAccount({ id: "hidden-first", order: 1 });
    const visibleSecond = makeAccount({ id: "visible-second", order: 2 });
    const hiddenSecond = makeAccount({ id: "hidden-second", order: 3 });
    const fullAccounts = [hiddenSecond, visibleSecond, hiddenFirst, visibleFirst];
    const reorderedVisibleAccounts = [visibleSecond, visibleFirst];

    const merged = mergeReorderedVisibleAccounts(fullAccounts, reorderedVisibleAccounts);

    expect(merged.map((account) => account.id)).toEqual([
      "visible-second",
      "hidden-first",
      "visible-first",
      "hidden-second",
    ]);
    expect(fullAccounts.map((account) => account.id)).toEqual([
      "hidden-second",
      "visible-second",
      "hidden-first",
      "visible-first",
    ]);
    expect(reorderedVisibleAccounts.map((account) => account.id)).toEqual(["visible-second", "visible-first"]);
  });
});
