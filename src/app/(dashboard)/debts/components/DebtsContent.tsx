"use client";

import { useQuery } from "@tanstack/react-query";
import { History, Plus } from "lucide-react";

import { ClosedDebtsHistoryDialog } from "@/modules/debts/components/ClosedDebtsHistoryDialog";
import { CreateDebtDialog } from "@/modules/debts/components/CreateDebtDialog";
import { DebtsList } from "@/modules/debts/components/DebtsList";
import { DebtStatus, DebtType } from "@/modules/debts/debt.constants";
import { getDebts } from "@/modules/debts/debt.service";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { debtKeys } from "@/shared/lib/query-keys";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { formatMoney, addMoney } from "@/shared/utils/money";

interface DebtsContentProps {
  workspaceId: string;
}

export function DebtsContent({ workspaceId }: DebtsContentProps) {
  const { isMobile } = useBreakpoints();
  const createDebtDialog = useDialogState();
  const historyDialog = useDialogState();

  const { data } = useQuery({
    queryKey: debtKeys.list(workspaceId),
    queryFn: () => getDebts(workspaceId),
    staleTime: 5000,
  });

  const debts = "data" in (data || {}) ? data?.data : [];
  const openDebts = debts?.filter((d) => d.status === DebtStatus.OPEN) || [];

  const lentTotal = openDebts
    .filter((d) => d.type === DebtType.LENT)
    .reduce(
      (acc, d) => {
        const currency = d.currency;
        if (!acc[currency]) acc[currency] = "0";
        acc[currency] = addMoney(acc[currency], d.remainingAmount);
        return acc;
      },
      {} as Record<string, string>
    );

  const borrowedTotal = openDebts
    .filter((d) => d.type === DebtType.BORROWED)
    .reduce(
      (acc, d) => {
        const currency = d.currency;
        if (!acc[currency]) acc[currency] = "0";
        acc[currency] = addMoney(acc[currency], d.remainingAmount);
        return acc;
      },
      {} as Record<string, string>
    );

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Долги</h1>
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => historyDialog.openDialog(null)}>
                <History className="size-4" />
                История
              </Button>
              <Button onClick={() => createDebtDialog.openDialog(null)}>
                <Plus className="size-4" />
                Добавить долг
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-muted-foreground shrink-0">Кредит:</span>
            {Object.entries(lentTotal).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(lentTotal).map(([currency, amount]) => (
                  <Badge key={currency} variant="default" className="bg-success-primary/10 text-success-primary">
                    {formatMoney(amount, currency)}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-muted-foreground shrink-0">Дебет:</span>
            {Object.entries(borrowedTotal).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(borrowedTotal).map(([currency, amount]) => (
                  <Badge key={currency} variant="destructive" className="bg-error-primary/10 text-error-primary">
                    {formatMoney(amount, currency)}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <DebtsList workspaceId={workspaceId} />
      </div>

      {createDebtDialog.mounted && (
        <CreateDebtDialog
          workspaceId={workspaceId}
          open={createDebtDialog.open}
          onOpenChange={createDebtDialog.closeDialog}
          onCloseComplete={createDebtDialog.unmountDialog}
        />
      )}

      {historyDialog.mounted && (
        <ClosedDebtsHistoryDialog
          workspaceId={workspaceId}
          open={historyDialog.open}
          onOpenChange={historyDialog.closeDialog}
          onCloseComplete={historyDialog.unmountDialog}
        />
      )}
    </div>
  );
}
