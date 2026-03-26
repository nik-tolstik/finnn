"use client";

import type { Account } from "@prisma/client";
import { useTheme } from "next-themes";
import type { CSSProperties, HTMLAttributes } from "react";

import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { UserDisplay } from "../UserDisplay";
import { hexToRgba } from "./account-card.utils";

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
  const { resolvedTheme } = useTheme();
  const AccountIcon = getAccountIcon(account.icon);
  const accountColor = account.color ?? "";

  const cardContent = (
    <>
      <div className="flex flex-col items-start gap-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AccountIcon className="size-4 shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="text-sm leading-none">{account.name}</div>
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
          </div>
          <div className="shrink-0">
            <p className="font-medium text-sm text-foreground">{formatMoney(account.balance, account.currency)}</p>
          </div>
        </div>
      </div>
    </>
  );

  const darkStyle: CSSProperties = {
    backgroundColor: hexToRgba(accountColor, 0.16),
    borderColor: hexToRgba(accountColor, 0.28),
    backgroundImage: `linear-gradient(110deg, ${hexToRgba(accountColor, 0.18)} 0%, ${hexToRgba(accountColor, 0.06)} 60%, ${hexToRgba(accountColor, 0.02)} 100%)`,
    boxShadow: hexToRgba(accountColor, 0.14),
  };

  const lightStyle: CSSProperties = {
    backgroundColor: hexToRgba(accountColor, 0.16),
    borderColor: hexToRgba(accountColor, 0.28),
  };

  const contentProps: HTMLAttributes<HTMLElement> = {
    className: cn(
      "relative flex w-full flex-col overflow-hidden rounded-xl border text-left text-card-foreground backdrop-blur-md backdrop-saturate-150 select-none touch-pan-y [webkit-touch-callout:none] [webkit-user-select:none]",
      className
    ),
    style: resolvedTheme === "dark" ? darkStyle : lightStyle,
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
