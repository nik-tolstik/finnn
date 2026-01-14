"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowUpDown } from "lucide-react";
import type React from "react";

import { UserDisplay } from "@/shared/components/UserDisplay";
import { Card } from "@/shared/ui/card";
import { IconWithBg } from "@/shared/ui/icon-with-bg";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import type { TransactionWithRelations } from "../transaction.types";

interface TransferAccount {
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
}

interface TransferCardProps {
  transaction: TransactionWithRelations;
  transferTo: {
    account: TransferAccount;
    amount: string;
  };
  onClick?: () => void;
}

type IconComponent = ReturnType<typeof getAccountIcon>;

function AccountName({
  account,
  icon: Icon,
  amount: _amount,
}: {
  account: TransferAccount;
  icon: IconComponent;
  amount?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <IconWithBg icon={Icon} color={account.color} className="size-6 sm:size-7" iconClassName="size-3.5 sm:size-4" />
      <div>{account.name}</div>
      {account.owner && (
        <UserDisplay
          name={account.owner?.name}
          email={account.owner?.email}
          image={account.owner?.image}
          size="sm"
          showName={true}
        />
      )}
    </div>
  );
}

function AccountWithAmount({
  account,
  amount,
  icon: Icon,
  amountClassName,
  className,
  isNegative,
}: {
  account: TransferAccount;
  amount: string;
  icon: IconComponent;
  amountClassName?: string;
  className?: string;
  isNegative?: boolean;
}) {
  return (
    <div className={cn("flex items-center md:gap-4 gap-2", className)}>
      <AccountName account={account} icon={Icon} amount={amount} />
      <span className={cn("text-muted-foreground text-sm", amountClassName)}>
        {isNegative ? "-" : "+"}
        {formatMoney(amount, account.currency)}
      </span>
    </div>
  );
}

export function TransferCard({ transaction, transferTo, onClick }: TransferCardProps) {
  const FromAccountIcon = getAccountIcon(transaction.account.icon);
  const ToAccountIcon = getAccountIcon(transferTo.account.icon);

  const description =
    transaction.description?.startsWith("Перевод на ") || transaction.description?.startsWith("Перевод с ")
      ? undefined
      : transaction.description;

  const fromAccount: TransferAccount = {
    ...transaction.account,
    owner: transaction.account.owner,
  };

  return (
    <Card
      className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer text-sm flex flex-col"
      onClick={onClick}
    >
      <div className="flex w-full justify-between items-center py-1">
        <span className="text-xs font-medium">Перевод</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(transaction.date), "HH:mm", { locale: ru })}
        </span>
      </div>

      <div className="flex md:items-center md:justify-between w-full md:flex-row flex-col gap-2">
        <AccountWithAmount
          account={transferTo.account}
          amount={transferTo.amount}
          icon={ToAccountIcon}
          amountClassName="text-error-primary"
          className="flex-1 justify-between"
        />
        <div className="flex items-center gap-2">
          <div className="w-full h-px bg-primary/10" />
          <div className="bg-primary/10 rounded-full p-1">
            <ArrowUpDown className="size-3 text-primary shrink-0 rotate-90" />
          </div>
          <div className="w-full h-px bg-primary/10" />
        </div>
        <AccountWithAmount
          account={fromAccount}
          amount={transaction.amount}
          icon={FromAccountIcon}
          amountClassName="text-success-primary"
          className={cn("flex-1 md:flex-row-reverse justify-between")}
        />
      </div>

      {description && <p className="text-xs sm:text-sm text-muted-foreground truncate">{description}</p>}
    </Card>
  );
}
