import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, User } from "lucide-react";
import type { KeyboardEvent } from "react";

import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { DebtStatus, DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";

interface DebtCardProps {
  debt: DebtWithRelations;
  onClick?: () => void;
}

export function DebtCard({ debt, onClick }: DebtCardProps) {
  const isLent = debt.type === DebtType.LENT;
  const isClosed = debt.status === DebtStatus.CLOSED;
  const directionLabel = isLent ? "Мне должны" : "Я должен";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onClick();
  };

  return (
    <AnimatedListItem>
      <Card
        className={cn(
          "p-3 sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30",
          onClick && "cursor-pointer",
          isClosed ? "hover:bg-surface-hover" : "hover:shadow-md transition-shadow"
        )}
        onClick={onClick}
        onKeyDown={onClick ? handleKeyDown : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {isClosed ? (
          <div className="flex min-w-0 items-start gap-3 text-sm">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                isLent ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {isLent ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{directionLabel}</span>
                    <Badge variant="secondary" className="gap-1 rounded-full px-2 py-0.5 text-[11px]">
                      <CheckCircle2 className="size-3.5" />
                      Закрыт
                    </Badge>
                  </div>
                  <div className="mt-1 flex min-w-0 items-start gap-1.5">
                    <User className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 break-words font-semibold">{debt.personName}</span>
                  </div>
                </div>

                <time className="shrink-0 text-xs text-muted-foreground" dateTime={debt.date.toISOString()}>
                  {format(new Date(debt.date), "dd.MM.yyyy", { locale: ru })}
                </time>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">Сумма</div>
                  <div className="mt-0.5 break-words text-sm font-semibold text-foreground">
                    {formatMoney(debt.amount, debt.currency)}
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[11px] text-muted-foreground">Остаток</div>
                  <div className="mt-0.5 break-words text-sm font-semibold text-foreground">
                    {formatMoney(debt.remainingAmount, debt.currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xs font-medium">{directionLabel}</div>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(debt.date), "dd.MM.yyyy", { locale: ru })}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center",
                    isLent ? "bg-success/10" : "bg-destructive/10"
                  )}
                >
                  {isLent ? (
                    <ArrowDownLeft className="size-4 text-success" />
                  ) : (
                    <ArrowUpRight className="size-4 text-destructive" />
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{debt.personName}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={cn("font-medium", isLent ? "text-success" : "text-destructive")}>
                  {formatMoney(debt.remainingAmount, debt.currency)}
                </div>
                {debt.remainingAmount !== debt.amount && (
                  <div className="text-xs text-muted-foreground line-through">
                    {formatMoney(debt.amount, debt.currency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </AnimatedListItem>
  );
}
