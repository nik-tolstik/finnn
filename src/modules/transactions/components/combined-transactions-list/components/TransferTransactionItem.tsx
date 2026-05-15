import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { UserDisplay } from "@/shared/components/UserDisplay";
import { Card } from "@/shared/ui/card";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { hexToRgba } from "@/shared/utils/color-utils";
import { formatMoney } from "@/shared/utils/money";

import type { TransferTransactionWithRelations } from "../../../transaction.types";

interface TransferTransactionItemProps {
  transaction: TransferTransactionWithRelations;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onClick: (transaction: TransferTransactionWithRelations) => void;
}

interface TransferAccountChipProps {
  color: string | null;
  icon: ReactNode;
  label: string;
}

function TransferAccountChip({ color, icon, label }: TransferAccountChipProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit min-w-0 max-w-full justify-self-start items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-foreground",
        !color && "bg-muted"
      )}
      style={{
        borderColor: color ? hexToRgba(color, 0.5) : undefined,
        backgroundColor: color ? hexToRgba(color, 0.08) : undefined,
      }}
    >
      <span className="shrink-0" style={{ color: color ?? undefined }}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function TransferTransactionItem({ transaction, onClick }: TransferTransactionItemProps) {
  const FromAccountIcon = getAccountIcon(transaction.fromAccount.icon);
  const ToAccountIcon = getAccountIcon(transaction.toAccount.icon);
  const description = transaction.description?.trim();

  return (
    <Card
      className="cursor-pointer p-3 transition-colors hover:bg-accent/70 sm:p-4"
      onClick={() => {
        onClick(transaction);
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold leading-relaxed">Перевод</span>
          <span className="text-right text-sm font-semibold leading-relaxed tabular-nums text-amber-600 dark:text-amber-400">
            {formatMoney(transaction.amount, transaction.fromAccount.currency)}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TransferAccountChip
              color={transaction.fromAccount.color}
              icon={<FromAccountIcon className="size-3.5" />}
              label={transaction.fromAccount.name}
            />
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <TransferAccountChip
              color={transaction.toAccount.color}
              icon={<ToAccountIcon className="size-3.5" />}
              label={transaction.toAccount.name}
            />
          </div>
          <span className="text-right text-sm font-normal leading-relaxed tabular-nums text-foreground">
            {formatMoney(transaction.toAmount, transaction.toAccount.currency)}
          </span>
        </div>
        {transaction.createdBy ? (
          <div>
            <UserDisplay
              name={transaction.createdBy.name}
              email={transaction.createdBy.email}
              image={transaction.createdBy.image}
              showName
              size="sm"
            />
          </div>
        ) : null}
        {description ? (
          <p className="border-t border-border mt-2 pt-2 text-xs text-muted-foreground leading-snug wrap-break-word">
            {description}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
