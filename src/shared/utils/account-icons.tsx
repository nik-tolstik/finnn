import { CreditCard, type LucideIcon, HandCoins, Landmark, Wallet } from "lucide-react";

export const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
} as const;

export type AccountIconName = keyof typeof ACCOUNT_ICONS;

export function getAccountIcon(iconName?: string | null): LucideIcon {
  if (iconName && iconName in ACCOUNT_ICONS) {
    return ACCOUNT_ICONS[iconName as AccountIconName];
  }

  return HandCoins;
}
