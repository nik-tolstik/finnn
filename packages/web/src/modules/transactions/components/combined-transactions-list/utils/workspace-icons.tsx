import { Building2, CreditCard, HandCoins, Landmark, type LucideIcon, Wallet } from "lucide-react";

const WORKSPACE_ICONS = {
  Building2,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
} satisfies Record<string, LucideIcon>;

type WorkspaceIconName = keyof typeof WORKSPACE_ICONS;

export function getWorkspaceIcon(iconName?: string | null): LucideIcon {
  if (iconName && iconName in WORKSPACE_ICONS) {
    return WORKSPACE_ICONS[iconName as WorkspaceIconName];
  }

  return Building2;
}
