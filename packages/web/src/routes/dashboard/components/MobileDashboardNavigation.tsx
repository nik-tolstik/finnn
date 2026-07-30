import { Plus } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav";

const loadCreateDebtDialog = () =>
  import("@/modules/debts/components/create-debt-dialog").then((module) => ({ default: module.CreateDebtDialog }));
const CreateDebtDialog = lazy(loadCreateDebtDialog);
const loadCreateScheduledPaymentDialog = () =>
  import("@/modules/scheduled-payments/components/CreateScheduledPaymentDialog").then((module) => ({
    default: module.CreateScheduledPaymentDialog,
  }));
const CreateScheduledPaymentDialog = lazy(loadCreateScheduledPaymentDialog);

export function MobileDashboardNavigation() {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const basePath = workspaceId ? `?workspaceId=${workspaceId}` : "";
  const createTransactionDialog = useDialogState();
  const createDebtDialog = useDialogState();
  const createScheduledPaymentDialog = useDialogState<null>();
  const isDebtsPage = pathname === "/debts";
  const isPaymentsPage = pathname === "/payments";
  const actionLabel = isPaymentsPage ? "Добавить платёж" : isDebtsPage ? "Добавить долг" : "Добавить транзакцию";

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    if (isPaymentsPage) {
      void loadCreateScheduledPaymentDialog().catch(() => undefined);
    } else if (isDebtsPage) {
      void loadCreateDebtDialog().catch(() => undefined);
    }
  }, [isDebtsPage, isPaymentsPage, workspaceId]);

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
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.5rem)] z-50 flex items-center justify-between gap-2">
        <nav className="pointer-events-auto relative isolate grid min-w-0 max-w-sm flex-1 grid-cols-4 gap-1 rounded-full border border-white/40 bg-background/72 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.20)] backdrop-blur-2xl dark:border-white/10 dark:bg-background/70">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Tooltip content={item.label} delayDuration={0} disableHoverableContent key={item.href} side="top">
                <Link
                  to={`${item.href}${basePath}`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "relative z-10 flex h-12 min-w-0 items-center justify-center rounded-full px-1 transition-[color,background-color,transform] motion-safe:active:scale-[0.94]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        <Tooltip content={actionLabel} delayDuration={0} disableHoverableContent side="top">
          <Button
            type="button"
            onClick={handleClick}
            size="icon"
            disabled={!workspaceId}
            aria-label={actionLabel}
            className="pointer-events-auto size-12 rounded-full border border-white/40 bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(47,107,255,0.28)] backdrop-blur-2xl hover:bg-primary/90 dark:border-white/10 sm:size-14"
          >
            <Plus className="size-5 sm:size-6" />
          </Button>
        </Tooltip>
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
        <Suspense fallback={null}>
          <CreateDebtDialog
            workspaceId={workspaceId}
            open={createDebtDialog.open}
            onOpenChange={createDebtDialog.closeDialog}
            onCloseComplete={createDebtDialog.unmountDialog}
          />
        </Suspense>
      )}
      {createScheduledPaymentDialog.mounted && workspaceId && (
        <Suspense fallback={null}>
          <CreateScheduledPaymentDialog
            workspaceId={workspaceId}
            open={createScheduledPaymentDialog.open}
            onOpenChange={createScheduledPaymentDialog.closeDialog}
            onCloseComplete={createScheduledPaymentDialog.unmountDialog}
          />
        </Suspense>
      )}
    </>
  );
}
