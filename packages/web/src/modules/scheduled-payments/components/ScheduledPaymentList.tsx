"use client";

import { Bell, Check, Pencil, SkipForward, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

import type { ScheduledPayment } from "../scheduled-payment.types";
import {
  formatScheduledPaymentDate,
  getScheduledPaymentAmountLabel,
  getScheduledPaymentScheduleLabel,
} from "../scheduled-payment.utils";
import { ScheduledPaymentStatusBadge } from "./ScheduledPaymentStatusBadge";

interface ScheduledPaymentListProps {
  isLoading?: boolean;
  onDelete: (payment: ScheduledPayment) => void;
  onEdit: (payment: ScheduledPayment) => void;
  onMarkPaid: (payment: ScheduledPayment) => void;
  onPaymentClick: (payment: ScheduledPayment) => void;
  onSkip: (payment: ScheduledPayment) => void;
  payments: ScheduledPayment[];
}

interface ScheduledPaymentGroup {
  dateKey: string;
  dateLabel: string;
  isOverdue: boolean;
  payments: ScheduledPayment[];
}

function getLocalDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function groupPaymentsByDate(payments: ScheduledPayment[]): ScheduledPaymentGroup[] {
  const groups = new Map<string, ScheduledPaymentGroup>();

  for (const payment of payments) {
    const dateKey = getLocalDateKey(payment.nextDueAt);
    const group = groups.get(dateKey) ?? {
      dateKey,
      dateLabel: formatScheduledPaymentDate(payment.nextDueAt),
      isOverdue: payment.displayStatus === "overdue",
      payments: [],
    };

    group.isOverdue = group.isOverdue || payment.displayStatus === "overdue";
    group.payments.push(payment);
    groups.set(dateKey, group);
  }

  return Array.from(groups.values());
}

function IconAction({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <Tooltip content={label}>
      <Button aria-label={label} onClick={onClick} size="icon-sm" type="button" variant="outline">
        {children}
      </Button>
    </Tooltip>
  );
}

function ScheduledPaymentDetails({ payment }: { payment: ScheduledPayment }) {
  return (
    <>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold">{payment.name}</h2>
          <ScheduledPaymentStatusBadge status={payment.displayStatus} />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {payment.notes || getScheduledPaymentScheduleLabel(payment)}
        </p>
      </div>

      <div className="text-sm">
        <div className="font-medium">{getScheduledPaymentAmountLabel(payment)}</div>
        <div className="text-xs text-muted-foreground">{getScheduledPaymentScheduleLabel(payment)}</div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 text-sm",
          payment.displayStatus === "overdue" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        <Bell
          className={cn(
            "size-4",
            payment.notifyEmail || payment.notifyTelegram ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span>{formatScheduledPaymentDate(payment.nextDueAt)}</span>
      </div>
    </>
  );
}

export function ScheduledPaymentList({
  isLoading,
  onDelete,
  onEdit,
  onMarkPaid,
  onPaymentClick,
  onSkip,
  payments,
}: ScheduledPaymentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="h-24 rounded-md border bg-muted/40 animate-pulse" key={index} />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Платежей нет</div>
    );
  }

  const groups = groupPaymentsByDate(payments);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section className="space-y-2" key={group.dateKey}>
          <div
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              group.isOverdue ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <span>{group.dateLabel}</span>
            {group.isOverdue && <span className="text-xs font-normal">Просрочено</span>}
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="divide-y">
              {group.payments.map((payment) => (
                <div key={payment.id}>
                  <button
                    className="grid w-full gap-3 p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    onClick={() => onPaymentClick(payment)}
                    type="button"
                  >
                    <ScheduledPaymentDetails payment={payment} />
                  </button>

                  <div className="hidden gap-3 p-4 md:grid md:grid-cols-[1.2fr_0.9fr_0.8fr_auto] md:items-center">
                    <ScheduledPaymentDetails payment={payment} />

                    <div className="flex items-center gap-2 md:justify-end">
                      <IconAction label="Редактировать" onClick={() => onEdit(payment)}>
                        <Pencil className="size-4" />
                      </IconAction>
                      <IconAction label="Оплачено" onClick={() => onMarkPaid(payment)}>
                        <Check className="size-4" />
                      </IconAction>
                      <IconAction label="Пропустить" onClick={() => onSkip(payment)}>
                        <SkipForward className="size-4" />
                      </IconAction>
                      <IconAction label="Удалить" onClick={() => onDelete(payment)}>
                        <Trash2 className="size-4" />
                      </IconAction>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
