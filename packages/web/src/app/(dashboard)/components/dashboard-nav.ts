import { BarChart3, HandCoins, type LucideIcon, Wallet } from "lucide-react";

export interface DashboardNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    href: "/dashboard",
    icon: Wallet,
    label: "Счета",
  },
  {
    href: "/analytics",
    icon: BarChart3,
    label: "Аналитика",
  },
  {
    href: "/debts",
    icon: HandCoins,
    label: "Долги",
  },
];
