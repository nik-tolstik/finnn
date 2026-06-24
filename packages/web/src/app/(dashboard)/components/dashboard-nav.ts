import { BarChart3, CalendarClock, HandCoins, type LucideIcon, Wallet } from "lucide-react";

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
    href: "/payments",
    icon: CalendarClock,
    label: "Платежи",
  },
  {
    href: "/debts",
    icon: HandCoins,
    label: "Долги",
  },
];
