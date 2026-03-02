"use client";

import { LayoutDashboard, Wallet, Receipt, Tag, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

const navigation = [
  { name: "Панель", href: "/dashboard", icon: LayoutDashboard },
  { name: "Счета", href: "/accounts", icon: Wallet },
  { name: "Транзакции", href: "/transactions", icon: Receipt },
  { name: "Категории", href: "/categories", icon: Tag },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-muted/40">
      <div className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Finnn</h2>
        <nav>
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded px-3 py-2 transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="mt-auto border-t p-4">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </aside>
  );
}
