"use client";

import type { Account } from "@prisma/client";
import type { CSSProperties, HTMLAttributes } from "react";

import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { hexToRgba } from "@/shared/utils/color-utils";
import { formatMoney } from "@/shared/utils/money";

import { UserDisplay } from "../UserDisplay";

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
  const accountColor = account.color ?? "";
  const getAccountTint = (alpha: number) => hexToRgba(accountColor, alpha) ?? `rgba(255, 255, 255, ${alpha})`;

  const cardContent = (
    <>
      <div className="flex flex-col items-start gap-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AccountIcon className="size-4 shrink-0" />
              <div className="text-sm leading-none">{account.name}</div>
            </div>
            {showOwner && account.owner && (
              <UserDisplay
                name={account.owner.name}
                email={account.owner.email}
                image={account.owner.image}
                size="sm"
                showName={true}
              />
            )}
          </div>
          <div className="shrink-0">
            <p className="font-medium text-sm text-foreground">{formatMoney(account.balance, account.currency)}</p>
          </div>
        </div>
      </div>
    </>
  );

  const style = {
    "--account-bg": getAccountTint(0.16),
    "--account-border": getAccountTint(0.28),
    "--account-bg-gradient": `linear-gradient(110deg, ${getAccountTint(0.18)} 0%, ${getAccountTint(0.06)} 60%, ${getAccountTint(0.02)} 100%)`,
    "--account-shadow": getAccountTint(0.14),
  } as CSSProperties;

  if (!account.color) {
    style["--account-bg" as keyof CSSProperties] = undefined;
    style["--account-border" as keyof CSSProperties] = undefined;
    style["--account-bg-gradient" as keyof CSSProperties] = undefined;
    style["--account-shadow" as keyof CSSProperties] = undefined;
  }

  const contentProps: HTMLAttributes<HTMLElement> = {
    className: cn(
      "relative flex w-full flex-col overflow-hidden rounded-xl border bg-[var(--account-bg)] border-[var(--account-border)] text-left text-card-foreground backdrop-blur-md backdrop-saturate-150 dark:[background-image:var(--account-bg-gradient)] dark:[box-shadow:0_12px_32px_var(--account-shadow)] select-none touch-pan-y [webkit-touch-callout:none] [webkit-user-select:none]",
      !account.color && "bg-transparent border-border dark:[background-image:none] dark:[box-shadow:none]",
      className
    ),
    style,
    children: cardContent,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        {...contentProps}
        className={cn("cursor-pointer", contentProps.className)}
      />
    );
  }

  return <div {...contentProps} />;
}
