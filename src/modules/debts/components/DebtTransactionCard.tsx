"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowUpDown, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Card } from "@/shared/ui/card";
import { IconWithBg } from "@/shared/ui/icon-with-bg";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { DebtType, DebtTransactionType } from "../debt.constants";
import type { DebtTransactionWithRelations } from "../debt.types";

interface DebtTransactionCardProps {
  debtTransaction: DebtTransactionWithRelations;
  onClick?: () => void;
  workspaceName?: string;
  workspaceIcon?: LucideIcon;
}

function getDebtTransactionTitle(debtType: string, transactionType: string): string {
  if (debtType === DebtType.LENT) {
    switch (transactionType) {
      case DebtTransactionType.CREATED:
        return "Я дал в долг";
      case DebtTransactionType.CLOSED:
        return "Мне вернули долг";
      case DebtTransactionType.ADDED:
        return "Я добавил к долгу";
      default:
        return "Долг";
    }
  } else {
    switch (transactionType) {
      case DebtTransactionType.CREATED:
        return "Мне дали в долг";
      case DebtTransactionType.CLOSED:
        return "Я вернул долг";
      case DebtTransactionType.ADDED:
        return "Мне добавили к долгу";
      default:
        return "Долг";
    }
  }
}

function getMoneyDirection(debtType: string, transactionType: string): "toAccount" | "fromAccount" {
  if (debtType === DebtType.LENT) {
    if (transactionType === DebtTransactionType.CLOSED) {
      return "toAccount";
    }
    return "fromAccount";
  } else {
    if (transactionType === DebtTransactionType.CLOSED) {
      return "fromAccount";
    }
    return "toAccount";
  }
}

function PersonWithAmount({
  personName,
  amount,
  currency,
  amountClassName,
  className,
  isNegative,
}: {
  personName: string;
  amount: string;
  currency: string;
  amountClassName?: string;
  className?: string;
  isNegative: boolean;
}) {
  return (
    <div className={cn("flex items-center md:gap-4 gap-2", className)}>
      <div className="flex items-center gap-2">
        <IconWithBg icon={User} color="#6b7280" className="size-6 sm:size-7" iconClassName="size-3.5 sm:size-4" />
        <div>{personName}</div>
      </div>
      <span className={cn("text-muted-foreground text-sm", amountClassName)}>
        {isNegative ? "-" : "+"}
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

function AccountWithAmount({
  account,
  amount,
  currency,
  amountClassName,
  className,
  isNegative,
}: {
  account: DebtTransactionWithRelations["account"];
  amount: string;
  currency: string;
  amountClassName?: string;
  className?: string;
  isNegative: boolean;
}) {
  if (!account) return null;

  const AccountIcon = getAccountIcon(account.icon);

  return (
    <div className={cn("flex items-center md:gap-4 gap-2", className)}>
      <div className="flex items-center gap-2">
        <IconWithBg
          icon={AccountIcon}
          color={account.color}
          className="size-6 sm:size-7"
          iconClassName="size-3.5 sm:size-4"
        />
        <div>{account.name}</div>
      </div>
      <span className={cn("text-muted-foreground text-sm", amountClassName)}>
        {isNegative ? "-" : "+"}
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

export function DebtTransactionCard({ debtTransaction, onClick }: DebtTransactionCardProps) {
  const title = getDebtTransactionTitle(debtTransaction.debt.type, debtTransaction.type);
  const moneyDirection = getMoneyDirection(debtTransaction.debt.type, debtTransaction.type);

  const accountAmount = debtTransaction.toAmount || debtTransaction.amount;
  const accountCurrency = debtTransaction.account?.currency || debtTransaction.debt.currency;

  return (
    <AnimatedListItem>
      <Card
        className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer text-sm flex flex-col"
        onClick={onClick}
      >
        <div className="flex w-full justify-between items-center py-1">
          <span className="text-xs font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(debtTransaction.date), "HH:mm", { locale: ru })}
          </span>
        </div>

        <div className="flex md:items-center md:justify-between w-full md:flex-row flex-col gap-2">
          {moneyDirection === "fromAccount" ? (
            <>
              {debtTransaction.account ? (
                <AccountWithAmount
                  account={debtTransaction.account}
                  amount={accountAmount}
                  currency={accountCurrency}
                  amountClassName="text-error-primary"
                  className="flex-1 justify-between"
                  isNegative={true}
                />
              ) : (
                <PersonWithAmount
                  personName="Мой кошелёк"
                  amount={debtTransaction.amount}
                  currency={debtTransaction.debt.currency}
                  amountClassName="text-error-primary"
                  className="flex-1 justify-between"
                  isNegative={true}
                />
              )}
              <div className="flex items-center gap-2">
                <div className="w-full h-px bg-primary/10" />
                <div className="bg-primary/10 rounded-full p-1">
                  <ArrowUpDown className="size-3 text-primary shrink-0 rotate-90" />
                </div>
                <div className="w-full h-px bg-primary/10" />
              </div>
              <PersonWithAmount
                personName={debtTransaction.debt.personName}
                amount={debtTransaction.amount}
                currency={debtTransaction.debt.currency}
                amountClassName="text-success-primary"
                className={cn("flex-1 md:flex-row-reverse justify-between")}
                isNegative={false}
              />
            </>
          ) : (
            <>
              <PersonWithAmount
                personName={debtTransaction.debt.personName}
                amount={debtTransaction.amount}
                currency={debtTransaction.debt.currency}
                amountClassName="text-error-primary"
                className="flex-1 justify-between"
                isNegative={true}
              />
              <div className="flex items-center gap-2">
                <div className="w-full h-px bg-primary/10" />
                <div className="bg-primary/10 rounded-full p-1">
                  <ArrowUpDown className="size-3 text-primary shrink-0 rotate-90" />
                </div>
                <div className="w-full h-px bg-primary/10" />
              </div>
              {debtTransaction.account ? (
                <AccountWithAmount
                  account={debtTransaction.account}
                  amount={accountAmount}
                  currency={accountCurrency}
                  amountClassName="text-success-primary"
                  className={cn("flex-1 md:flex-row-reverse justify-between")}
                  isNegative={false}
                />
              ) : (
                <PersonWithAmount
                  personName="Мой кошелёк"
                  amount={debtTransaction.amount}
                  currency={debtTransaction.debt.currency}
                  amountClassName="text-success-primary"
                  className={cn("flex-1 md:flex-row-reverse justify-between")}
                  isNegative={false}
                />
              )}
            </>
          )}
        </div>
      </Card>
    </AnimatedListItem>
  );
}
