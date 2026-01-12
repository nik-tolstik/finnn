"use client";

import type { Account } from "@prisma/client";

import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

interface AccountCardProps {
  account: Account & {
    owner?: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    } | null;
  };
  className?: string;
  onClick?: () => void;
  showOwner?: boolean;
}

export function AccountCard({ account, className, onClick, showOwner = true }: AccountCardProps) {
  const AccountIcon = getAccountIcon(account.icon);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-card text-card-foreground flex flex-col rounded-xl shadow-sm",
        onClick && "cursor-pointer",
        !account.color && "bg-card",

        className
      )}
      style={{
        ...(account.color
          ? {
              background: `linear-gradient(to right, var(--card), ${account.color})`,
            }
          : {}),
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        userSelect: "none",
        touchAction: "pan-y",
      }}
      onClick={onClick}
    >
      <div className="flex flex-col items-start gap-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 bg-primary/10">
              <AccountIcon className="text-primary h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm leading-none">{account.name}</div>
            </div>
          </div>
          <div className="shrink-0">
            <p className="font-bold text-base">{formatMoney(account.balance, account.currency)}</p>
          </div>
        </div>
        {showOwner && account.owner && (
          <div className="mt-2 text-xs text-muted-foreground">{account.owner.name || account.owner.email}</div>
        )}
      </div>
    </div>
  );
}
