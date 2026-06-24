"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import { getCategories } from "@/modules/categories/category.api";
import { CreateDebtDialog } from "@/modules/debts/components/create-debt-dialog";
import { ScheduledPaymentForm } from "@/modules/scheduled-payments/components/ScheduledPaymentForm";
import { createScheduledPayment } from "@/modules/scheduled-payments/scheduled-payment.api";
import type { ScheduledPaymentFormInput } from "@/modules/scheduled-payments/scheduled-payment.types";
import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { getWorkspaceMembers, getWorkspaceSummary } from "@/modules/workspace/workspace.api";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { accountKeys, categoryKeys, scheduledPaymentKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav";

const MotionLink = motion.create(Link);

type MaybeActionData<T> = T | { data?: T; error?: string; success?: boolean } | undefined;

function getQueryData<T>(value: MaybeActionData<T>, fallback: T): T {
  if (value && typeof value === "object") {
    if ("data" in value) {
      return value.data ?? fallback;
    }

    if ("error" in value || "success" in value) {
      return fallback;
    }
  }

  return (value as T | undefined) ?? fallback;
}

interface CreateScheduledPaymentFabDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

function CreateScheduledPaymentFabDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
}: CreateScheduledPaymentFabDialogProps) {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
  });
  const categoriesQuery = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
  });
  const workspaceQuery = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
  });

  const accounts = getQueryData(accountsQuery.data, []);
  const categories = getQueryData(categoriesQuery.data, []).filter((category) => category.type === "expense");
  const members = getQueryData(membersQuery.data, []);
  const workspace = getQueryData(workspaceQuery.data, null);

  const createMutation = useMutation({
    mutationFn: (input: ScheduledPaymentFormInput) => createScheduledPayment(workspaceId, input),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Платёж создан");
      void queryClient.invalidateQueries({ queryKey: scheduledPaymentKeys.all(workspaceId) });
    },
  });

  return (
    <ScheduledPaymentForm
      accounts={accounts}
      baseCurrency={workspace?.baseCurrency}
      categories={categories}
      initialPayment={null}
      members={members}
      open={open}
      workspaceId={workspaceId}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      onSubmit={async (input) => {
        const result = await createMutation.mutateAsync(input);
        if ("error" in result) throw new Error(result.error);
      }}
    />
  );
}

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
  const createScheduledPaymentDialog = useDialogState();
  const isDebtsPage = pathname === "/debts";
  const isPaymentsPage = pathname === "/payments";
  const actionLabel = isPaymentsPage ? "Добавить платёж" : isDebtsPage ? "Добавить долг" : "Добавить транзакцию";
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

    if (isPaymentsPage) {
      createScheduledPaymentDialog.openDialog(null);
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
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.5rem)] z-50 flex items-center justify-start md:hidden">
        <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-2">
          <nav
            ref={navRef}
            className="relative isolate grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-full border border-white/40 bg-background/72 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.20)] backdrop-blur-2xl dark:border-white/10 dark:bg-background/70"
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
            {DASHBOARD_NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <MotionLink
                  ref={(node) => {
                    linkRefs.current[index] = node;
                  }}
                  href={`${item.href}${basePath}`}
                  key={item.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 520, damping: 32, mass: 0.5 }}
                  className={cn(
                    "relative z-10 flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors",
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
            aria-label={actionLabel}
            className="size-12 rounded-full border border-white/40 bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(47,107,255,0.28)] backdrop-blur-2xl hover:bg-primary/90 dark:border-white/10 sm:size-14"
          >
            <Plus className="size-5 sm:size-6" />
          </Button>
        </div>
      </div>
      {(isPaymentsPage || isDebtsPage) && (
        <div className="pointer-events-none fixed right-6 bottom-6 z-50 hidden md:block">
          <Button
            type="button"
            onClick={handleClick}
            size="icon"
            disabled={!workspaceId}
            aria-label={actionLabel}
            className="pointer-events-auto size-14 rounded-full border border-white/40 bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(47,107,255,0.28)] backdrop-blur-2xl hover:bg-primary/90 dark:border-white/10"
          >
            <Plus className="size-6" />
          </Button>
        </div>
      )}
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
      {createScheduledPaymentDialog.mounted && workspaceId && (
        <CreateScheduledPaymentFabDialog
          workspaceId={workspaceId}
          open={createScheduledPaymentDialog.open}
          onOpenChange={createScheduledPaymentDialog.closeDialog}
          onCloseComplete={createScheduledPaymentDialog.unmountDialog}
        />
      )}
    </>
  );
}
