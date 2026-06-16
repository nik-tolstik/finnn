"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardExchangeRatesList, useDashboardExchangeRates } from "./dashboard-exchange-rates";

export function ExchangeRatesTicker() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setWorkspaceId(searchParams.get("workspaceId") || undefined);
  }, [searchParams]);

  const { isLoading, rates, shouldRender } = useDashboardExchangeRates(workspaceId);

  if (!isMounted || isLoading) {
    return (
      <div className="h-8 overflow-hidden border-b bg-muted/50 md:hidden">
        <div className="flex items-center h-full px-4 sm:px-8">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="h-8 border-b bg-muted/50 md:hidden">
      <div className="flex h-full items-center px-4 sm:px-8">
        <DashboardExchangeRatesList rates={rates} />
      </div>
    </div>
  );
}
