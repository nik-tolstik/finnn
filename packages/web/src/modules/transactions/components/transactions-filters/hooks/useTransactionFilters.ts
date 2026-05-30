"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { TransactionViewFilters } from "../types";
import {
  applyTransactionFiltersToSearchParams,
  countActiveTransactionFilterGroups,
  parseTransactionFilters,
  shouldIncludeDebtTransactions,
} from "../utils/search-params";

export function useTransactionFilters() {
  const searchParams = useSearchParams();
  const [appliedFilters, setAppliedFilters] = useState(() => parseTransactionFilters(searchParams));

  useEffect(() => {
    setAppliedFilters(parseTransactionFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const handlePopState = () => {
      setAppliedFilters(parseTransactionFilters(new URLSearchParams(window.location.search)));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const appliedFiltersCount = useMemo(() => countActiveTransactionFilterGroups(appliedFilters), [appliedFilters]);
  const appliedFiltersKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const includeDebtTransactions = useMemo(
    () => shouldIncludeDebtTransactions(appliedFilters.transactionTypes),
    [appliedFilters.transactionTypes]
  );

  const applyFilters = useCallback(
    (nextFilters: TransactionViewFilters) => {
      const currentSearchParams =
        typeof window === "undefined"
          ? new URLSearchParams(searchParams.toString())
          : new URLSearchParams(window.location.search);
      const nextSearchParams = applyTransactionFiltersToSearchParams(currentSearchParams, nextFilters);
      const queryString = nextSearchParams.toString();
      const nextUrl =
        typeof window === "undefined"
          ? queryString
            ? `?${queryString}`
            : ""
          : `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;

      setAppliedFilters(parseTransactionFilters(nextSearchParams));

      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    },
    [searchParams]
  );

  const resetFilters = useCallback(() => {
    applyFilters({});
  }, [applyFilters]);

  return {
    appliedFilters,
    appliedFiltersCount,
    appliedFiltersKey,
    includeDebtTransactions,
    isNavigationPending: false,
    applyFilters,
    resetFilters,
  };
}
