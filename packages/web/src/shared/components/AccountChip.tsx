"use client";

import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { hexToRgba } from "@/shared/utils/color-utils";

export interface AccountChipAccount {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  ownerId?: string | null;
  owner?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface AccountChipProps {
  account: AccountChipAccount;
  className?: string;
}

export function AccountChip({ account, className }: AccountChipProps) {
  const AccountIcon = getAccountIcon(account.icon);

  return (
    <div
      className={cn(
        "inline-flex min-w-0 max-w-[190px] items-center gap-1.5 rounded-md px-2 py-1",
        !account.color && "bg-muted/50",
        className
      )}
      style={{ backgroundColor: account.color ? hexToRgba(account.color, 0.1) : undefined }}
    >
      <AccountIcon className="size-3.5 shrink-0" style={{ color: account.color ?? undefined }} />
      <span className="truncate text-xs font-medium">{account.name}</span>
    </div>
  );
}
