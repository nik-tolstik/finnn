"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MoreHorizontal, User } from "lucide-react";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { debtKeys } from "@/shared/lib/query-keys";
import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { DebtStatus, DebtType } from "../debt.constants";
import { getDebts } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";
import { AddToDebtDialog } from "./AddToDebtDialog";
import { CloseDebtDialog } from "./CloseDebtDialog";
import { DebtActionsDialog } from "./DebtActionsDialog";
import { DebtCard } from "./DebtCard";
import { DeleteDebtDialog } from "./DeleteDebtDialog";
import { EditDebtDialog } from "./EditDebtDialog";

interface DebtsListProps {
  workspaceId: string;
}

function hexToRgba(hex: string | null, alpha: number): string | undefined {
  if (!hex) {
    return undefined;
  }

  const normalized = hex.replace(/^#/, "");

  if (normalized.length !== 6 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    return undefined;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function DebtTypeBadge({ debt }: { debt: DebtWithRelations }) {
  const isLent = debt.type === DebtType.LENT;
  const label = isLent ? "Кредит" : "Дебет";

  return <div className="text-sm">{label}</div>;
}

function DebtAccountChip({ debt }: { debt: DebtWithRelations }) {
  if (!debt.account) {
    return <span className="text-sm text-muted-foreground">Без счёта</span>;
  }

  const AccountIcon = getAccountIcon(debt.account.icon);

  return (
    <div
      className="inline-flex max-w-[190px] items-center gap-1.5 rounded-md border px-2 py-1"
      style={{
        borderColor: hexToRgba(debt.account.color, 0.45),
        backgroundColor: hexToRgba(debt.account.color, 0.1),
      }}
    >
      <AccountIcon className="size-3.5" style={{ color: debt.account.color ?? undefined }} />
      <span className="truncate text-xs font-medium">{debt.account.name}</span>
    </div>
  );
}

function DebtsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table className="min-w-[880px]">
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Тип
            </TableHead>
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Контрагент
            </TableHead>
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Счёт
            </TableHead>
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Дата
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Сумма
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Остаток
            </TableHead>
            <TableHead className="h-10 w-12 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="sr-only">Действия</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4].map((row) => (
            <TableRow key={row} className="hover:bg-transparent">
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-7 w-36 rounded-md" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <Skeleton className="ml-auto h-4 w-24" />
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <Skeleton className="ml-auto h-4 w-24" />
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <Skeleton className="ml-auto size-7 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DebtsTable({
  debts,
  onDebtClick,
}: {
  debts: DebtWithRelations[];
  onDebtClick: (debt: DebtWithRelations) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table className="min-w-[880px]">
        <TableHeader className="bg-muted/30">
          <TableRow className="border-b border-border hover:bg-transparent">
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Тип
            </TableHead>
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Контрагент
            </TableHead>
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Счёт
            </TableHead>
            <TableHead className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Дата
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Сумма
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Остаток
            </TableHead>
            <TableHead className="h-10 w-12 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="sr-only">Действия</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debts.map((debt) => {
            return (
              <TableRow
                key={debt.id}
                className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/35"
                onClick={() => onDebtClick(debt)}
              >
                <TableCell className="px-4 py-3">
                  <DebtTypeBadge debt={debt} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <User className={cn("size-3.5", "text-foreground")} />
                    <div className="truncate text-sm">{debt.personName}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <DebtAccountChip debt={debt} />
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                  {format(new Date(debt.date), "dd.MM.yyyy", { locale: ru })}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-foreground">{formatMoney(debt.amount, debt.currency)}</div>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {formatMoney(debt.remainingAmount, debt.currency)}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label={`Открыть действия для долга ${debt.personName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDebtClick(debt);
                    }}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function DebtsList({ workspaceId }: DebtsListProps) {
  const { isMobile } = useBreakpoints();
  const actionsDialog = useDialogState<DebtWithRelations>();
  const closeDialog = useDialogState<DebtWithRelations>();
  const addMoreDialog = useDialogState<DebtWithRelations>();
  const deleteDialog = useDialogState<DebtWithRelations>();
  const editDialog = useDialogState<DebtWithRelations>();

  const { data, isLoading } = useQuery({
    queryKey: debtKeys.list(workspaceId),
    queryFn: () => getDebts(workspaceId),
    staleTime: 5000,
  });

  const debts = (data?.data || []).filter((d) => d.status === DebtStatus.OPEN);

  const handleDebtClick = (debt: DebtWithRelations) => {
    actionsDialog.openDialog(debt);
  };

  const handleClose = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        closeDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  const handleAddMore = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        addMoreDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  const handleDelete = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        deleteDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  const handleEdit = () => {
    if (actionsDialog.data) {
      actionsDialog.closeDialog();
      setTimeout(() => {
        editDialog.openDialog(actionsDialog.data);
      }, 200);
    }
  };

  if (isLoading) {
    if (isMobile) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      );
    }

    return <DebtsTableSkeleton />;
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Долгов пока нет</p>
        <p className="text-sm mt-1">
          {isMobile
            ? "Создайте первый долг, нажав кнопку с плюсиком внизу справа"
            : "Создайте первый долг, нажав кнопку выше"}
        </p>
      </div>
    );
  }

  return (
    <>
      {isMobile ? (
        <div className="space-y-3">
          {debts.map((debt) => (
            <AnimatedListItem key={debt.id}>
              <DebtCard debt={debt} onClick={() => handleDebtClick(debt)} />
            </AnimatedListItem>
          ))}
        </div>
      ) : (
        <DebtsTable debts={debts} onDebtClick={handleDebtClick} />
      )}

      {actionsDialog.mounted && actionsDialog.data && (
        <DebtActionsDialog
          debt={actionsDialog.data}
          open={actionsDialog.open}
          onOpenChange={actionsDialog.closeDialog}
          onCloseComplete={actionsDialog.unmountDialog}
          onClose={handleClose}
          onAddMore={handleAddMore}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )}

      {editDialog.mounted && editDialog.data && (
        <EditDebtDialog
          debt={editDialog.data}
          workspaceId={workspaceId}
          open={editDialog.open}
          onOpenChange={editDialog.closeDialog}
          onCloseComplete={editDialog.unmountDialog}
        />
      )}

      {closeDialog.mounted && closeDialog.data && (
        <CloseDebtDialog
          debt={closeDialog.data}
          workspaceId={workspaceId}
          open={closeDialog.open}
          onOpenChange={closeDialog.closeDialog}
          onCloseComplete={closeDialog.unmountDialog}
        />
      )}

      {addMoreDialog.mounted && addMoreDialog.data && (
        <AddToDebtDialog
          debt={addMoreDialog.data}
          workspaceId={workspaceId}
          open={addMoreDialog.open}
          onOpenChange={addMoreDialog.closeDialog}
          onCloseComplete={addMoreDialog.unmountDialog}
        />
      )}

      {deleteDialog.mounted && deleteDialog.data && (
        <DeleteDebtDialog
          debt={deleteDialog.data}
          workspaceId={workspaceId}
          open={deleteDialog.open}
          onOpenChange={deleteDialog.closeDialog}
        />
      )}
    </>
  );
}
