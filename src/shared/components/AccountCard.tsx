"use client";

import type { Account } from "@prisma/client";

import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { getContrastTextColor } from "@/shared/utils/color-utils";
import { formatMoney } from "@/shared/utils/money";

import { UserDisplay } from "./UserDisplay";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "").trim();
  const normalizedHex = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const r = parseInt(normalizedHex.slice(0, 2), 16);
  const g = parseInt(normalizedHex.slice(2, 4), 16);
  const b = parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const hasColor = Boolean(account.color);
  const cardTint = hasColor ? hexToRgba(account.color as string, 0.20) : "rgba(255, 255, 255, 0.05)";
  const borderTint = hasColor ? hexToRgba(account.color as string, 0.34) : "rgba(255, 255, 255, 0.14)";
  const iconTint = hasColor ? hexToRgba(account.color as string, 0.24) : "rgba(255, 255, 255, 0.10)";
  const focusGlow = hasColor ? hexToRgba(account.color as string, 0.18) : "rgba(255, 255, 255, 0.08)";

  return (
    <div
      className={cn(
        "relative overflow-hidden border text-card-foreground flex flex-col rounded-xl shadow-sm backdrop-blur-md backdrop-saturate-150",
        onClick && "cursor-pointer",

        className
      )}
      style={{
        backgroundColor: cardTint,
        borderColor: borderTint,
        backgroundImage: hasColor
          ? `linear-gradient(110deg, ${hexToRgba(account.color as string, 0.24)} 0%, ${hexToRgba(account.color as string, 0.06)} 60%, rgba(255, 255, 255, 0.06) 100%)`
          : undefined,
        boxShadow: `0 14px 38px ${focusGlow}`,
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
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 border border-white/10"
              style={{ backgroundColor: iconTint }}
            >
              <AccountIcon
                className="h-3.5 w-3.5"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="font-semibold text-sm leading-none">{account.name}</div>
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
            <p
              className="font-bold text-base"
              style={
                account.color
                  ? {
                      color: getContrastTextColor(account.color),
                    }
                  : undefined
              }
            >
              {formatMoney(account.balance, account.currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
