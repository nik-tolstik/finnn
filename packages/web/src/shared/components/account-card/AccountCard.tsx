"use client";

import type { CSSProperties, HTMLAttributes } from "react";

import type { Account } from "@/modules/accounts/account.types";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { hexToRgba } from "@/shared/utils/color-utils";
import { formatMoney } from "@/shared/utils/money";

interface AccountCardProps {
  account: Account & {
    owner?: {
      name: string | null;
      email?: string | null;
      image: string | null;
    } | null;
  };
  className?: string;
  contentClassName?: string;
  onClick?: () => void;
  showOwner?: boolean;
}

export function AccountCard({ account, className, contentClassName, onClick, showOwner = true }: AccountCardProps) {
  const AccountIcon = getAccountIcon(account.icon);
  const accountColor = account.color ?? "";
  const accountTint = hexToRgba(accountColor, 0.1) ?? "var(--surface-subtle)";
  const accountTintHover = hexToRgba(accountColor, 0.16) ?? "var(--surface-hover)";
  const accountTintDark = hexToRgba(accountColor, 0.16) ?? "var(--surface-subtle)";
  const accountTintDarkHover = hexToRgba(accountColor, 0.22) ?? "var(--surface-hover)";
  const ownerLabel = account.owner?.name || account.owner?.email || (account.owner === null ? "Общий счёт" : null);

  const cardContent = (
    <>
      <div
        aria-hidden="true"
        className="flex w-[52px] shrink-0 items-center justify-center bg-[var(--account-tint)] text-[var(--account-color)] transition-colors duration-200 group-hover:bg-[var(--account-tint-hover)] dark:bg-[var(--account-tint-dark)] dark:group-hover:bg-[var(--account-tint-dark-hover)]"
      >
        <AccountIcon className="size-5 shrink-0" />
      </div>
      <div className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5 py-2", contentClassName)}>
        <div className="flex min-w-0 flex-col justify-center">
          <p className="truncate text-sm font-medium leading-4 text-foreground">{account.name || "Название счёта"}</p>
          {showOwner && ownerLabel && (
            <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{ownerLabel}</p>
          )}
        </div>
        <p className="max-w-[58%] shrink-0 truncate text-right text-base font-semibold leading-5 tracking-[-0.01em] text-foreground">
          {formatMoney(account.balance, account.currency)}
        </p>
      </div>
    </>
  );

  const style = {
    "--account-color": accountColor || "var(--text-secondary)",
    "--account-tint": accountTint,
    "--account-tint-hover": accountTintHover,
    "--account-tint-dark": accountTintDark,
    "--account-tint-dark-hover": accountTintDarkHover,
  } as CSSProperties;

  const contentProps: HTMLAttributes<HTMLElement> = {
    className: cn(
      "relative flex min-h-16 w-full overflow-hidden rounded-xl bg-account-card text-left text-card-foreground shadow-[var(--account-card-shadow)] transition-[background-color,box-shadow,transform] duration-200 select-none touch-pan-y [webkit-touch-callout:none] [webkit-user-select:none]",
      onClick &&
        "group cursor-pointer hover:bg-account-card-hover hover:shadow-[var(--account-card-shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30 active:scale-[0.995]",
      className
    ),
    style,
    children: cardContent,
  };

  if (onClick) {
    return <button type="button" onClick={onClick} {...contentProps} className={contentProps.className} />;
  }

  return <div {...contentProps} />;
}
