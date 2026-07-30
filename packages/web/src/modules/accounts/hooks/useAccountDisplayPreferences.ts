import { useCallback, useEffect, useState } from "react";

import type {
  AccountDisplayDirection,
  AccountDisplayGrouping,
  AccountDisplaySort,
} from "../components/accounts-cards/account-display";

export interface AccountDisplayPreferences {
  direction: AccountDisplayDirection;
  grouping: AccountDisplayGrouping;
  sort: AccountDisplaySort;
}

const STORAGE_KEY_PREFIX = "finnn:dashboard-account-display:v1:";

export const DEFAULT_ACCOUNT_DISPLAY_PREFERENCES: AccountDisplayPreferences = {
  direction: "asc",
  grouping: "owner",
  sort: "custom",
};

function isSort(value: unknown): value is AccountDisplaySort {
  return value === "custom" || value === "name" || value === "balance";
}

function isDirection(value: unknown): value is AccountDisplayDirection {
  return value === "asc" || value === "desc";
}

function isGrouping(value: unknown): value is AccountDisplayGrouping {
  return value === "none" || value === "owner" || value === "currency";
}

function parsePreferences(value: string | null): AccountDisplayPreferences {
  if (!value) {
    return DEFAULT_ACCOUNT_DISPLAY_PREFERENCES;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_ACCOUNT_DISPLAY_PREFERENCES;
    }

    const candidate = parsed as Partial<AccountDisplayPreferences>;

    if (!isSort(candidate.sort) || !isDirection(candidate.direction) || !isGrouping(candidate.grouping)) {
      return DEFAULT_ACCOUNT_DISPLAY_PREFERENCES;
    }

    return {
      direction: candidate.direction,
      grouping: candidate.grouping,
      sort: candidate.sort,
    };
  } catch {
    return DEFAULT_ACCOUNT_DISPLAY_PREFERENCES;
  }
}

export function useAccountDisplayPreferences(workspaceId: string) {
  const [preferences, setPreferences] = useState<AccountDisplayPreferences>(DEFAULT_ACCOUNT_DISPLAY_PREFERENCES);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const storageKey = `${STORAGE_KEY_PREFIX}${workspaceId}`;

  useEffect(() => {
    try {
      setPreferences(parsePreferences(window.localStorage.getItem(storageKey)));
    } catch {
      setPreferences(DEFAULT_ACCOUNT_DISPLAY_PREFERENCES);
    }
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Preferences stay available for the current dashboard session.
    }
  }, [loadedStorageKey, preferences, storageKey]);

  const selectGrouping = useCallback((grouping: AccountDisplayGrouping) => {
    setPreferences((current) => ({ ...current, grouping }));
  }, []);

  const selectSort = useCallback((sort: AccountDisplaySort) => {
    setPreferences((current) => {
      if (sort === "custom") {
        return { ...current, sort };
      }

      if (current.sort === sort) {
        return {
          ...current,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        ...current,
        direction: sort === "balance" ? "desc" : "asc",
        sort,
      };
    });
  }, []);

  return {
    preferences,
    selectGrouping,
    selectSort,
  };
}
