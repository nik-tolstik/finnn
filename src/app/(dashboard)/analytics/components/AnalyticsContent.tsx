"use client";

import { useState, useCallback } from "react";

import { AccountFilter } from "@/modules/analytics/components/AccountFilter";
import { CapitalChart } from "@/modules/analytics/components/CapitalChart";
import { CategoryChart } from "@/modules/analytics/components/CategoryChart";
import { CurrencyStats } from "@/modules/analytics/components/CurrencyStats";
import { DateRangeFilter } from "@/modules/analytics/components/DateRangeFilter";

interface AnalyticsContentProps {
  workspaceId: string;
  baseCurrency: string;
}

export function AnalyticsContent({ workspaceId, baseCurrency }: AnalyticsContentProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [dateTo, setDateTo] = useState(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[] | undefined>();

  const handleDateRangeChange = useCallback((newDateFrom: Date, newDateTo: Date) => {
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Аналитика</h1>
        <div className="w-full sm:w-64">
          <AccountFilter
            workspaceId={workspaceId}
            selectedAccountIds={selectedAccountIds}
            onAccountIdsChange={setSelectedAccountIds}
          />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Общая статистика</h2>
        <CurrencyStats workspaceId={workspaceId} selectedAccountIds={selectedAccountIds} />
      </div>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Графики</h2>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="w-full sm:w-[200px]">
              <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateRangeChange={handleDateRangeChange} />
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Изменение капитала</h3>
            <CapitalChart
              workspaceId={workspaceId}
              baseCurrency={baseCurrency}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedAccountIds={selectedAccountIds}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Расходы и доходы по категориям</h3>
            <CategoryChart
              workspaceId={workspaceId}
              baseCurrency={baseCurrency}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedAccountIds={selectedAccountIds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
