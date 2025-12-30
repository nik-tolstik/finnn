"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { ContextMenu, ContextMenuItem } from "@/shared/ui/context-menu";

import { deleteTransaction } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";

import { EditTransactionDialog } from "./EditTransactionDialog";
import { EditTransferDialog } from "./EditTransferDialog";
import { TransactionCard } from "./TransactionCard";
import { TransferCard } from "./TransferCard";

interface TransactionsListProps {
  transactions: TransactionWithRelations[];
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  workspaceId: string;
}

export function TransactionsList({
  transactions,
  showLoadMore,
  onLoadMore,
  workspaceId,
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
  const [contextMenu, setContextMenu] = useState<{
    transaction: TransactionWithRelations;
    x: number;
    y: number;
  } | null>(null);

  const handleDelete = async (transaction: TransactionWithRelations) => {
    setContextMenu(null);

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
          queryClient.setQueryData(
            ["transactions", workspaceId],
            previousTransactions
          );
        }
      } else {
        await queryClient.invalidateQueries({
          queryKey: ["transactions", workspaceId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["accounts", workspaceId],
        });
        router.refresh();
      }
    } catch {
      toast.error("Не удалось удалить транзакцию");
      if (previousTransactions) {
        queryClient.setQueryData(
          ["transactions", workspaceId],
          previousTransactions
        );
      }
    }
  };
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет транзакций.
      </div>
    );
  }

  const processedTransactionIds = new Set<string>();

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => {
        const isTransfer = transaction.type === "transfer";

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
                };
                amount: string;
              }
            | undefined;

          if (transaction.transferFrom) {
            transferInfo = {
              account: transaction.transferFrom.toTransaction.account,
              amount: transaction.transferFrom.toAmount,
            };
            processedTransactionIds.add(
              transaction.transferFrom.toTransaction.id
            );
          }

          if (!transferInfo) {
            return null;
          }

          return (
            <TransferCard
              key={transaction.id}
              transaction={transaction}
              transferTo={transferInfo}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  transaction,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
            />
          );
        }

        return (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                transaction,
                x: e.clientX,
                y: e.clientY,
              });
            }}
          />
        );
      })}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          open={!!contextMenu}
          onOpenChange={(open) => !open && setContextMenu(null)}
        >
          <ContextMenuItem
            onClick={() => {
              if (contextMenu.transaction.type === "transfer") {
                editTransferDialog.openDialog({
                  transaction: contextMenu.transaction,
                  workspaceId,
                });
              } else {
                editTransactionDialog.openDialog({
                  transaction: contextMenu.transaction,
                  workspaceId,
                });
              }
              setContextMenu(null);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Редактировать
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              handleDelete(contextMenu.transaction);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить
          </ContextMenuItem>
        </ContextMenu>
      )}
      {editTransactionDialog.mounted && (
        <EditTransactionDialog
          transaction={editTransactionDialog.data.transaction}
          workspaceId={editTransactionDialog.data.workspaceId}
          open={editTransactionDialog.open}
          onOpenChange={editTransactionDialog.closeDialog}
        />
      )}
      {editTransferDialog.mounted &&
        editTransferDialog.data.transaction.transferFrom && (
          <EditTransferDialog
            transaction={editTransferDialog.data.transaction}
            workspaceId={editTransferDialog.data.workspaceId}
            open={editTransferDialog.open}
            onOpenChange={editTransferDialog.closeDialog}
          />
        )}
      {showLoadMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>
            Показать ещё
          </Button>
        </div>
      )}
    </div>
  );
}
