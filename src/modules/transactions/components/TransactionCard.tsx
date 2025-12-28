"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDown, ArrowUp, Icon } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { IconWithBg } from "@/shared/ui/icon-with-bg";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { formatMoney } from "@/shared/utils/money";

import type { TransactionWithRelations } from "../transaction.types";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
} from "../transaction.constants";
import { cn } from "@/shared/utils/cn";

interface TransactionCardProps {
  transaction: TransactionWithRelations;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function TransactionCard({
  transaction,
  onContextMenu,
}: TransactionCardProps) {
  const AccountIcon = getAccountIcon(transaction.account.icon);

  return (
    <Card
      className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer"
      onContextMenu={onContextMenu}
    >
      <div className="flex flex-col text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {
                TRANSACTION_TYPE_LABELS[
                  transaction.type as keyof typeof TRANSACTION_TYPE_LABELS
                ]
              }
            </span>
            {transaction.category && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: transaction.category.color || undefined,
                }}
              >
                {transaction.category.name}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(transaction.date), "dd.MM.yyyy", {
              locale: ru,
            })}
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
            <div>{transaction.account.name}</div>
          </div>
          <div
            className={cn(
              transaction.type === "income" ? "text-lime-500" : "text-pink-500"
            )}
          >
            {transaction.type === "income" ? "+" : "-"}
            {formatMoney(transaction.amount, transaction.account.currency)}
          </div>
        </div>
      </div>
    </Card>
  );
}
