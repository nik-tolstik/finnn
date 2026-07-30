import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import type { TransactionViewFilters } from "../types";
import {
  applyTransactionFiltersToSearchParams,
  countActiveTransactionFilterGroups,
  parseTransactionFilters,
  shouldIncludeDebtTransactions,
} from "../utils/search-params";

export function useTransactionFilters() {
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const [appliedFilters, setAppliedFilters] = useState(() => parseTransactionFilters(searchParams));

  useEffect(() => {
    setAppliedFilters(parseTransactionFilters(searchParams));
  }, [searchParams]);

  const appliedFiltersCount = useMemo(() => countActiveTransactionFilterGroups(appliedFilters), [appliedFilters]);
  const appliedFiltersKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const includeDebtTransactions = useMemo(
    () => shouldIncludeDebtTransactions(appliedFilters.transactionTypes),
    [appliedFilters.transactionTypes]
  );

  const applyFilters = useCallback(
    (nextFilters: TransactionViewFilters) => {
      const currentSearchParams = new URLSearchParams(searchParams);
      const nextSearchParams = applyTransactionFiltersToSearchParams(currentSearchParams, nextFilters);
      const queryString = nextSearchParams.toString();

      setAppliedFilters(parseTransactionFilters(nextSearchParams));

      navigate(
        {
          pathname,
          search: queryString ? `?${queryString}` : "",
          hash,
        },
        { replace: true, preventScrollReset: true }
      );
    },
    [hash, navigate, pathname, searchParams]
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
