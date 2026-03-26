"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";

import { UserDisplay } from "@/shared/components/UserDisplay";
import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { IconWithBg } from "@/shared/ui/icon-with-bg";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { TransactionType } from "../transaction.constants";
import type { TransactionWithRelations } from "../transaction.types";

interface TransactionCardProps {
  transaction: TransactionWithRelations;
  onClick?: () => void;
  workspaceName?: string;
  workspaceIcon?: LucideIcon;
}

export function TransactionCard({
  transaction,
  onClick,
  workspaceName,
  workspaceIcon: WorkspaceIcon,
}: TransactionCardProps) {
  const AccountIcon = getAccountIcon(transaction.account.icon);
  const isSharedAccount = transaction.account.ownerId === null;

  return (
    <AnimatedListItem>
      <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
        <div className="flex flex-col text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs font-normal"
                style={{
                  borderColor: transaction.category?.color || undefined,
                }}
              >
                {transaction.category?.name || "Без категории"}
              </Badge>

              {isSharedAccount && workspaceName && WorkspaceIcon ? (
                <div className="flex items-center gap-2">
                  <WorkspaceIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{workspaceName}</span>
                </div>
              ) : transaction.account.owner ? (
                <UserDisplay
                  name={transaction.account.owner.name}
                  email={transaction.account.owner.email}
                  size="sm"
                  showName={true}
                />
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(transaction.date), "HH:mm", { locale: ru })}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2 py-1 rounded-lg">
              <IconWithBg
                icon={AccountIcon}
                color={transaction.account.color}
                className="size-6 sm:size-7"
                iconClassName="size-3.5 sm:size-4"
              />
              <div className="flex flex-col">
                <div>{transaction.account.name}</div>
              </div>
            </div>
            <div
              className={cn(transaction.type === TransactionType.INCOME ? "text-success-primary" : "text-error-primary")}
            >
              {transaction.type === TransactionType.INCOME ? "+" : "-"}
              {formatMoney(transaction.amount, transaction.account.currency)}
            </div>
          </div>
          {transaction.description && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate mt-2">{transaction.description}</p>
          )}
        </div>
      </Card>
    </AnimatedListItem>

  );
}
