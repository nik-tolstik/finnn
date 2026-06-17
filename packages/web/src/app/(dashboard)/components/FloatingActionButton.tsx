"use client";

import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { CreateDebtDialog } from "@/modules/debts/components/create-debt-dialog";
import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav";

const MotionLink = motion.create(Link);

export function FloatingActionButton() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicatorMetrics, setIndicatorMetrics] = useState({
    height: 0,
    left: 0,
    top: 0,
    width: 0,
  });
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";
  const createTransactionDialog = useDialogState();
  const createDebtDialog = useDialogState();
  const isDebtsPage = pathname === "/debts";
  const selectedIndex = DASHBOARD_NAV_ITEMS.findIndex((item) => item.href === pathname);

  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    const selectedLink = selectedIndex >= 0 ? linkRefs.current[selectedIndex] : null;

    if (!nav || !selectedLink) {
      setIndicatorMetrics({
        height: 0,
        left: 0,
        top: 0,
        width: 0,
      });
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const linkRect = selectedLink.getBoundingClientRect();

    setIndicatorMetrics({
      height: linkRect.height,
      left: linkRect.left - navRect.left,
      top: linkRect.top - navRect.top,
      width: linkRect.width,
    });
  }, [selectedIndex]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const selectedLink = selectedIndex >= 0 ? linkRefs.current[selectedIndex] : null;

    if (!nav || !selectedLink) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(nav);
    resizeObserver.observe(selectedLink);
    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [selectedIndex, updateIndicator]);

  const handleClick = () => {
    if (!workspaceId) {
      return;
    }

    if (isDebtsPage) {
      createDebtDialog.openDialog(null);
      return;
    }

    createTransactionDialog.openDialog(null);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),0.5rem)] z-50 flex items-center justify-start md:hidden">
        <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3">
          <nav
            ref={navRef}
            aria-label="Основная мобильная навигация"
            className="relative isolate grid w-fit grid-cols-[repeat(3,4.5rem)] gap-1 rounded-full border border-white/40 bg-background/72 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.20)] backdrop-blur-2xl dark:border-white/10 dark:bg-background/70"
          >
            {indicatorMetrics.width > 0 ? (
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={indicatorMetrics}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
                className="pointer-events-none absolute rounded-full bg-primary shadow-sm"
              />
            ) : null}
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <MotionLink
                  ref={(node) => {
                    linkRefs.current[DASHBOARD_NAV_ITEMS.indexOf(item)] = node;
                  }}
                  href={`${item.href}${basePath}`}
                  key={item.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 520, damping: 32, mass: 0.5 }}
                  className={cn(
                    "relative z-10 flex h-12 flex-col items-center justify-center gap-0.5 rounded-full transition-colors",
                    isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="whitespace-nowrap text-[10px] font-medium leading-none">{item.label}</span>
                </MotionLink>
              );
            })}
          </nav>

          <Button
            type="button"
            onClick={handleClick}
            size="icon"
            disabled={!workspaceId}
            aria-label={isDebtsPage ? "Добавить долг" : "Добавить транзакцию"}
            className="size-14 rounded-full border border-white/40 bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(47,107,255,0.28)] backdrop-blur-2xl hover:bg-primary/90 dark:border-white/10"
          >
            <Plus className="size-6" />
          </Button>
        </div>
      </div>
      {createTransactionDialog.mounted && workspaceId && (
        <CreateTransactionDialog
          workspaceId={workspaceId}
          open={createTransactionDialog.open}
          onOpenChange={createTransactionDialog.closeDialog}
          onCloseComplete={createTransactionDialog.unmountDialog}
        />
      )}
      {createDebtDialog.mounted && workspaceId && (
        <CreateDebtDialog
          workspaceId={workspaceId}
          open={createDebtDialog.open}
          onOpenChange={createDebtDialog.closeDialog}
          onCloseComplete={createDebtDialog.unmountDialog}
        />
      )}
    </>
  );
}
