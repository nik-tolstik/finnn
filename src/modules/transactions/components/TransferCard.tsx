"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowDownIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUp,
  ArrowUpIcon,
  ChevronsRightIcon,
  CircleArrowRightIcon,
  Icon,
  LucideIcon,
} from "lucide-react";

import { Card } from "@/shared/ui/card";
import { getAccountIcon } from "@/shared/utils/account-icons";

import type { TransactionWithRelations } from "../transaction.types";
import { formatMoney } from "@/shared/utils/money";
import { IconWithBg } from "@/shared/ui/icon-with-bg";
import { cn } from "@/shared/utils/cn";

interface TransferAccount {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  icon: string | null;
}

interface TransferCardProps {
  transaction: TransactionWithRelations;
  transferTo: {
    account: TransferAccount;
    amount: string;
  };
  onContextMenu?: (e: React.MouseEvent) => void;
}

function AccountName({
  account,
  icon: Icon,
  amount,
}: {
  account: TransferAccount;
  icon: LucideIcon;
  amount?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 py-1 rounded-lg">
      <IconWithBg
        icon={Icon}
        color={account.color}
        className="size-6 sm:size-7"
        iconClassName="size-3.5 sm:size-4"
      />
      <div>{account.name}</div>
    </div>
  );
}

function AccountWithAmount({
  account,
  amount,
  icon: Icon,
  amountClassName,
  className,
}: {
  account: TransferAccount;
  amount: string;
  icon: LucideIcon;
  amountClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <AccountName account={account} icon={Icon} amount={amount} />
      <span className={cn("text-muted-foreground text-sm", amountClassName)}>
        {formatMoney(amount, account.currency)}
      </span>
    </div>
  );
}

export function TransferCard({
  transaction,
  transferTo,
  onContextMenu,
}: TransferCardProps) {
  const FromAccountIcon = getAccountIcon(transaction.account.icon);
  const ToAccountIcon = getAccountIcon(transferTo.account.icon);

  const description =
    transaction.description?.startsWith("Перевод на ") ||
    transaction.description?.startsWith("Перевод с ")
      ? undefined
      : transaction.description;

  return (
    <Card
      className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer text-sm"
      onContextMenu={onContextMenu}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
        <div className="flex flex-col gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Перевод</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(transaction.date), "dd.MM.yyyy", {
                  locale: ru,
                })}
              </span>
            </div>
            <div className="flex items-center gap-4 justify-between md:justify-start">
              <AccountWithAmount
                account={transferTo.account}
                amount={transferTo.amount}
                icon={ToAccountIcon}
                amountClassName="text-pink-500"
                className="flex-col items-start md:items-center md:flex-row"
              />
              <ArrowRightIcon className="size-4 text-muted-foreground shrink-0" />
              <AccountWithAmount
                account={transaction.account}
                amount={transaction.amount}
                icon={FromAccountIcon}
                amountClassName="text-lime-500"
                className="flex-col items-end md:items-center md:flex-row"
              />
            </div>
          </div>

          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {description}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
