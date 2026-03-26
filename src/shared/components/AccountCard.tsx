"use client";

import type { Account } from "@prisma/client";
import type { CSSProperties } from "react";

import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "@/shared/utils/color-utils";
import { formatMoney } from "@/shared/utils/money";

import { UserDisplay } from "./UserDisplay";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "").trim();
  const normalizedHex =
    normalized.length === 3
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

function getLightThemeIconColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "var(--foreground)";

  const hsl = rgbToHsl(rgb);
  return rgbToHex(
    hslToRgb({
      ...hsl,
      s: Math.max(hsl.s, 48),
      l: Math.min(hsl.l, 34),
    })
  );
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
  const dynamicSurfaceStyle: CSSProperties | undefined = hasColor
    ? {
        backgroundColor: hexToRgba(account.color as string, 0.16),
        borderColor: hexToRgba(account.color as string, 0.28),
        backgroundImage: `linear-gradient(110deg, ${hexToRgba(account.color as string, 0.18)} 0%, ${hexToRgba(account.color as string, 0.06)} 60%, ${hexToRgba(account.color as string, 0.02)} 100%)`,
        boxShadow: hexToRgba(account.color as string, 0.14),
      }
    : undefined;
  const dynamicIconStyle: CSSProperties | undefined = hasColor
    ? {
        backgroundColor: hexToRgba(account.color as string, 0.16),
        borderColor: hexToRgba(account.color as string, 0.18),
        ["--account-icon-color" as string]: account.color,
        ["--account-icon-color-light" as string]: getLightThemeIconColor(account.color as string),
      }
    : undefined;
  const isInteractive = Boolean(onClick);
  const cardClassName = cn(
    "relative flex w-full flex-col overflow-hidden rounded-xl border text-left text-card-foreground backdrop-blur-md backdrop-saturate-150 select-none touch-pan-y [webkit-touch-callout:none] [webkit-user-select:none]",
    !hasColor &&
      "border-[var(--account-card-border)] bg-[var(--account-card-bg)] shadow-[var(--account-card-shadow)] [background-image:var(--account-card-gradient)]",
    isInteractive && "cursor-pointer",
    className
  );

  const cardContent = (
    <>
      <div className="flex flex-col items-start gap-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg shrink-0 border",
                hasColor
                  ? "text-(--account-icon-color-light) dark:text-(--account-icon-color)"
                  : "border-(--account-card-border) bg-(--account-card-icon) text-foreground"
              )}
              style={dynamicIconStyle}
            >
              <AccountIcon className="h-3.5 w-3.5" />
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
            <p className="font-bold text-base text-foreground">{formatMoney(account.balance, account.currency)}</p>
          </div>
        </div>
      </div>
    </>
  );

  return isInteractive ? (
    <button type="button" className={cardClassName} style={dynamicSurfaceStyle} onClick={onClick}>
      {cardContent}
    </button>
  ) : (
    <div className={cardClassName} style={dynamicSurfaceStyle}>
      {cardContent}
    </div>
  );
}
