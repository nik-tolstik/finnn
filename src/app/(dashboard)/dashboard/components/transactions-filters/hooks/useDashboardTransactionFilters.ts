"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import type { DashboardTransactionFilters } from "../types";
import {
  applyTransactionFiltersToSearchParams,
  countActiveTransactionFilterGroups,
  parseTransactionFilters,
  shouldIncludeDebtTransactions,
} from "../utils/search-params";

export function useDashboardTransactionFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigationPending, startNavigationTransition] = useTransition();

  const appliedFilters = useMemo(() => parseTransactionFilters(searchParams), [searchParams]);
  const appliedFiltersCount = useMemo(() => countActiveTransactionFilterGroups(appliedFilters), [appliedFilters]);
  const appliedFiltersKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const includeDebtTransactions = useMemo(
    () => shouldIncludeDebtTransactions(appliedFilters.transactionTypes),
    [appliedFilters.transactionTypes]
  );

  const applyFilters = useCallback(
    (nextFilters: DashboardTransactionFilters) => {
      const nextSearchParams = applyTransactionFiltersToSearchParams(searchParams, nextFilters);
      const queryString = nextSearchParams.toString();

      startNavigationTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname);
      });
    },
    [pathname, router, searchParams]
  );

  const resetFilters = useCallback(() => {
    applyFilters({});
  }, [applyFilters]);

  return {
    appliedFilters,
    appliedFiltersCount,
    appliedFiltersKey,
    includeDebtTransactions,
    isNavigationPending,
    applyFilters,
    resetFilters,
  };
}
