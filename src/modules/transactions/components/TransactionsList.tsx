"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";

import { TransactionType } from "../transaction.constants";
import { deleteTransaction } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";

import { EditTransactionDialog } from "./EditTransactionDialog";
import { EditTransferDialog } from "./EditTransferDialog";
import { TransactionActionsDialog } from "./TransactionActionsDialog";
import { TransactionCard } from "./TransactionCard";
import { TransactionCardSkeleton } from "./TransactionCardSkeleton";
import { TransferCard } from "./TransferCard";
import { TransferCardSkeleton } from "./TransferCardSkeleton";

interface TransactionsListProps {
  transactions: TransactionWithRelations[];
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  workspaceId: string;
  isLoadingMore?: boolean;
}

export function TransactionsList({
  transactions,
  showLoadMore,
  onLoadMore,
  workspaceId,
  isLoadingMore,
}: TransactionsListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editTransactionDialog = useDialogState<{
    transaction: TransactionWithRelations;
    workspaceId: string;
  }>();
  const editTransferDialog = useDialogState<{
    transaction: TransactionWithRelations;
    workspaceId: string;
  }>();
  const actionsDialog = useDialogState<{
    transaction: TransactionWithRelations;
  }>();

  const handleDelete = async (transaction: TransactionWithRelations) => {
    const previousTransactions = queryClient.getQueryData<{
      data: TransactionWithRelations[];
    }>(["transactions", workspaceId]);

    if (previousTransactions) {
      queryClient.setQueryData(["transactions", workspaceId], {
        data: previousTransactions.data.filter((t) => t.id !== transaction.id),
      });
    }

    try {
      const result = await deleteTransaction(transaction.id);
      if (result.error) {
        toast.error(result.error);
        if (previousTransactions) {
          queryClient.setQueryData(["transactions", workspaceId], previousTransactions);
        }
      } else {
        await queryClient.invalidateQueries({
          queryKey: ["transactions", workspaceId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["accounts", workspaceId],
        });
        router.refresh();
        actionsDialog.closeDialog();
      }
    } catch {
      toast.error("Не удалось удалить транзакцию");
      if (previousTransactions) {
        queryClient.setQueryData(["transactions", workspaceId], previousTransactions);
      }
    }
  };

  const processedTransactionIds = new Set<string>();

  const groupedTransactions = useMemo(() => {
    if (transactions.length === 0) {
      return [];
    }
    const groups: Array<{ date: Date; transactions: TransactionWithRelations[] }> = [];
    let currentDate: Date | null = null;
    let currentGroup: TransactionWithRelations[] = [];

    transactions.forEach((transaction) => {
      const transactionDate = startOfDay(new Date(transaction.date));

      if (!currentDate || !isSameDay(currentDate, transactionDate)) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate!, transactions: currentGroup });
        }
        currentDate = transactionDate;
        currentGroup = [transaction];
      } else {
        currentGroup.push(transaction);
      }
    });

    if (currentGroup.length > 0 && currentDate) {
      groups.push({ date: currentDate, transactions: currentGroup });
    }

    return groups;
  }, [transactions]);

  const formatDateHeader = (date: Date) => {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(new Date());
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
      return "Сегодня";
    } else if (isSameDay(date, yesterday)) {
      return "Вчера";
    } else {
      return format(date, "d MMMM yyyy", { locale: ru });
    }
  };

  return (
    <div className="space-y-4">
      {groupedTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Нет транзакций.</div>
      ) : (
        groupedTransactions.map((group) => (
          <div key={group.date.toISOString()} className="space-y-3">
            <div className="sticky top-0 z-10 bg-background py-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {formatDateHeader(group.date)}
              </h3>
            </div>
            {group.transactions.map((transaction) => {
              const isTransfer = transaction.type === TransactionType.TRANSFER;

              if (isTransfer) {
                if (transaction.transferTo) {
                  return null;
                }

                if (processedTransactionIds.has(transaction.id)) {
                  return null;
                }

                let transferInfo:
                  | {
                    account: {
                      id: string;
                      name: string;
                      currency: string;
                      color: string | null;
                      icon: string | null;
                      owner?: {
                        id: string;
                        name: string | null;
                        email: string;
                        image: string | null;
                      } | null;
                    };
                    amount: string;
                  }
                  | undefined;

                if (transaction.transferFrom) {
                  transferInfo = {
                    account: {
                      ...transaction.transferFrom.toTransaction.account,
                      owner: transaction.transferFrom.toTransaction.account.owner,
                    },
                    amount: transaction.transferFrom.toAmount,
                  };
                  processedTransactionIds.add(transaction.transferFrom.toTransaction.id);
                }

                if (!transferInfo) {
                  return null;
                }

                return (
                  <TransferCard
                    key={transaction.id}
                    transaction={transaction}
                    transferTo={transferInfo}
                    onClick={() => {
                      actionsDialog.openDialog({ transaction });
                    }}
                  />
                );
              }

              return (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  onClick={() => {
                    actionsDialog.openDialog({ transaction });
                  }}
                />
              );
            })}
          </div>
        ))
      )}
      {actionsDialog.mounted && (
        <TransactionActionsDialog
          transaction={actionsDialog.data.transaction}
          open={actionsDialog.open}
          onOpenChange={actionsDialog.closeDialog}
          onCloseComplete={actionsDialog.unmountDialog}
          onEdit={() => {
            if (actionsDialog.data.transaction.type === TransactionType.TRANSFER) {
              editTransferDialog.openDialog({
                transaction: actionsDialog.data.transaction,
                workspaceId,
              });
              actionsDialog.closeDialog();
            } else {
              editTransactionDialog.openDialog({
                transaction: actionsDialog.data.transaction,
                workspaceId,
              });
              actionsDialog.closeDialog();
            }
          }}
          onDelete={() => {
            handleDelete(actionsDialog.data.transaction);
          }}
        />
      )}
      {editTransactionDialog.mounted && (
        <EditTransactionDialog
          transaction={editTransactionDialog.data.transaction}
          workspaceId={editTransactionDialog.data.workspaceId}
          open={editTransactionDialog.open}
          onOpenChange={editTransactionDialog.closeDialog}
          onCloseComplete={() => {
            editTransactionDialog.unmountDialog();
          }}
        />
      )}
      {editTransferDialog.mounted && (
        <EditTransferDialog
          transaction={editTransferDialog.data.transaction}
          workspaceId={editTransferDialog.data.workspaceId}
          open={editTransferDialog.open}
          onOpenChange={editTransferDialog.closeDialog}
          onCloseComplete={editTransferDialog.unmountDialog}
        />
      )}
      {isLoadingMore && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}>{index % 3 === 0 ? <TransferCardSkeleton /> : <TransactionCardSkeleton />}</div>
          ))}
        </div>
      )}
      {showLoadMore && onLoadMore && !isLoadingMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>
            Показать ещё
          </Button>
        </div>
      )}
    </div>
  );
}
