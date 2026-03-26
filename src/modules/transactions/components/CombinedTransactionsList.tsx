"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Building2, CreditCard, HandCoins, Landmark, type LucideIcon, Wallet } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.service";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { workspaceKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { getAccountIcon } from "@/shared/utils/account-icons";

import { TransactionType } from "../transaction.constants";
import { deleteTransaction } from "../transaction.service";
import type { CombinedTransaction, TransactionWithRelations } from "../transaction.types";
import { getTransactionDescriptionSegments } from "../utils/transactionDescription";
import { CreateTransactionDialog } from "./CreateTransactionDialog";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { EditTransferDialog } from "./EditTransferDialog";
import { TransactionActionsDialog } from "./TransactionActionsDialog";
import { TransactionDescriptionLine } from "./TransactionDescriptionLine";

const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  Building2,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
} as const;

function getWorkspaceIcon(iconName?: string | null): LucideIcon {
  if (iconName && iconName in WORKSPACE_ICONS) {
    return WORKSPACE_ICONS[iconName];
  }
  return Building2;
}

interface CombinedTransactionsListProps {
  transactions: CombinedTransaction[];
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  workspaceId: string;
  isLoadingMore?: boolean;
}

export function CombinedTransactionsList({
  transactions,
  showLoadMore,
  onLoadMore,
  workspaceId,
  isLoadingMore,
}: CombinedTransactionsListProps) {
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
  const createTransactionDialog = useDialogState<{
    workspaceId: string;
    account: TransactionWithRelations["account"];
    defaultType: TransactionType.INCOME | TransactionType.EXPENSE;
    initialAmount: string;
    initialDescription: string | undefined;
    initialDate: Date;
    initialCategoryId: string | undefined;
  }>();

  const { data: workspaceData } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
    staleTime: 5000,
  });

  const workspaceName = useMemo(() => {
    return workspaceData && "data" in workspaceData && workspaceData.data ? workspaceData.data.name : "";
  }, [workspaceData]);

  const WorkspaceIcon = useMemo(() => {
    return workspaceData && "data" in workspaceData && workspaceData.data
      ? getWorkspaceIcon(workspaceData.data.icon)
      : Building2;
  }, [workspaceData]);

  const handleRepeat = (transaction: TransactionWithRelations) => {
    if (transaction.type === TransactionType.TRANSFER) {
      return;
    }

    createTransactionDialog.openDialog({
      workspaceId,
      account: transaction.account,
      defaultType: transaction.type as TransactionType.INCOME | TransactionType.EXPENSE,
      initialAmount: transaction.amount,
      initialDescription: transaction.description || undefined,
      initialDate: new Date(),
      initialCategoryId: transaction.category?.id || undefined,
    });
    actionsDialog.closeDialog();
  };

  const handleDelete = async (transaction: TransactionWithRelations) => {
    try {
      const result = await deleteTransaction(transaction.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["transactions", "accounts"]);
        actionsDialog.closeDialog();
      }
    } catch {
      toast.error("Не удалось удалить транзакцию");
    }
  };

  const processedTransactionIds = new Set<string>();

  const groupedTransactions = useMemo(() => {
    if (transactions.length === 0) {
      return [];
    }
    const groups: Array<{ date: Date; transactions: CombinedTransaction[] }> = [];
    let currentDate: Date | null = null;
    let currentGroup: CombinedTransaction[] = [];

    transactions.forEach((transaction) => {
      const transactionDate = startOfDay(new Date(transaction.data.date));

      if (!currentDate) {
        currentDate = transactionDate;
        currentGroup = [transaction];
        return;
      }

      if (currentDate && !isSameDay(currentDate, transactionDate)) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, transactions: currentGroup });
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

  const renderTransaction = (item: CombinedTransaction) => {
    if (item.kind === "debtTransaction") {
      const { segments } = getTransactionDescriptionSegments(item, workspaceName);
      const dt = item.data;
      const isAccountOwnerActor =
        (dt.debt.type === DebtType.LENT && dt.type !== DebtTransactionType.CLOSED) ||
        (dt.debt.type === DebtType.BORROWED && dt.type === DebtTransactionType.CLOSED);
      const actorAvatar =
        isAccountOwnerActor && dt.account?.owner ? (
          <UserDisplay
            name={dt.account.owner.name}
            email={dt.account.owner.email}
            image={dt.account.owner.image}
            showName={false}
            size="sm"
          />
        ) : (
          <UserDisplay name={dt.debt.personName} image={null} showName={false} size="sm" />
        );
      const DebtAccountIcon = dt.account ? getAccountIcon(dt.account.icon) : null;
      const accountChips =
        dt.account != null && DebtAccountIcon
          ? {
              account: {
                color: dt.account.color,
                icon: <DebtAccountIcon className="size-3.5" />,
              },
            }
          : undefined;
      return (
        <TransactionDescriptionLine
          key={`debt-${item.data.id}`}
          segments={segments}
          icon={actorAvatar}
          accountChips={accountChips}
        />
      );
    }

    const transaction = item.data;
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
              ownerId?: string | null;
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
            ownerId: transaction.transferFrom.toTransaction.account.ownerId,
            owner: transaction.transferFrom.toTransaction.account.owner,
          },
          amount: transaction.transferFrom.toAmount,
        };
        processedTransactionIds.add(transaction.transferFrom.toTransaction.id);
      }

      if (!transferInfo) {
        return null;
      }

      const { segments } = getTransactionDescriptionSegments(item, workspaceName, {
        toAccountName: transferInfo.account.name,
        toAmount: transferInfo.amount,
        toCurrency: transferInfo.account.currency,
      });
      const actorAvatar =
        transaction.account.ownerId === null ? (
          <WorkspaceIcon className="size-4" />
        ) : (
          <UserDisplay
            name={transaction.account.owner?.name}
            email={transaction.account.owner?.email}
            image={transaction.account.owner?.image}
            showName={false}
            size="sm"
          />
        );
      const FromAccountIcon = getAccountIcon(transaction.account.icon);
      const ToAccountIcon = getAccountIcon(transferInfo.account.icon);
      const accountChips = {
        accountFrom: {
          color: transaction.account.color,
          icon: <FromAccountIcon className="size-3.5" />,
        },
        accountTo: {
          color: transferInfo.account.color,
          icon: <ToAccountIcon className="size-3.5" />,
        },
      };
      return (
        <TransactionDescriptionLine
          key={transaction.id}
          segments={segments}
          icon={actorAvatar}
          accountChips={accountChips}
          onClick={() => {
            actionsDialog.openDialog({ transaction });
          }}
        />
      );
    }

    const { segments } = getTransactionDescriptionSegments(item, workspaceName);
    const actorAvatar =
      transaction.account.ownerId === null ? (
        <WorkspaceIcon className="size-4" />
      ) : (
        <UserDisplay
          name={transaction.account.owner?.name}
          email={transaction.account.owner?.email}
          image={transaction.account.owner?.image}
          showName={false}
          size="sm"
        />
      );
    const AccountIcon = getAccountIcon(transaction.account.icon);
    const accountChips = {
      account: {
        color: transaction.account.color,
        icon: <AccountIcon className="size-3.5" />,
      },
    };
    return (
      <TransactionDescriptionLine
        key={transaction.id}
        segments={segments}
        icon={actorAvatar}
        accountChips={accountChips}
        categoryColor={transaction.category?.color ?? undefined}
        description={transaction.description?.trim() || undefined}
        onClick={() => {
          actionsDialog.openDialog({ transaction });
        }}
      />
    );
  };

  return (
    <div className="space-y-4">
      {groupedTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Нет транзакций.</div>
      ) : (
        groupedTransactions.map((group) => (
          <div key={group.date.toISOString()} className="space-y-3">
            <div className="sticky top-16 z-10 bg-background py-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {formatDateHeader(group.date)}
              </h3>
            </div>
            {group.transactions.map(renderTransaction)}
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
          onRepeat={() => {
            handleRepeat(actionsDialog.data.transaction);
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
      {createTransactionDialog.mounted && (
        <CreateTransactionDialog
          workspaceId={createTransactionDialog.data.workspaceId}
          account={createTransactionDialog.data.account}
          open={createTransactionDialog.open}
          onOpenChange={createTransactionDialog.closeDialog}
          onCloseComplete={createTransactionDialog.unmountDialog}
          defaultType={createTransactionDialog.data.defaultType}
          initialAmount={createTransactionDialog.data.initialAmount}
          initialDescription={createTransactionDialog.data.initialDescription}
          initialDate={createTransactionDialog.data.initialDate}
          initialCategoryId={createTransactionDialog.data.initialCategoryId}
        />
      )}
      {isLoadingMore && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-5 rounded bg-muted/50 animate-pulse" />
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
