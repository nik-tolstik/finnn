import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, User } from "lucide-react";
import type { KeyboardEvent } from "react";

import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { DebtStatus, DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";

interface DebtCardProps {
  debt: DebtWithRelations;
  onClick?: (anchor?: HTMLElement) => void;
}

export function DebtCard({ debt, onClick }: DebtCardProps) {
  const isLent = debt.type === DebtType.LENT;
  const isClosed = debt.status === DebtStatus.CLOSED;
  const directionLabel = isLent ? "Мне должны" : "Я должен";
  const debtDate = new Date(debt.date);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onClick(event.currentTarget);
  };

  return (
    <AnimatedListItem>
      <Card
        className={cn(
          "p-3 sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30",
          onClick && "cursor-pointer",
          isClosed ? "shadow-inner hover:bg-surface-hover" : "hover:shadow-md transition-shadow"
        )}
        aria-haspopup={onClick ? "dialog" : undefined}
        onClick={onClick ? (event) => onClick(event.currentTarget) : undefined}
        onKeyDown={onClick ? handleKeyDown : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {isClosed ? (
          <div className="grid min-w-0 grid-cols-2 items-start gap-x-3 gap-y-2 text-sm">
            <div className="min-w-0 text-xs font-medium text-muted-foreground">{directionLabel}</div>
            <time
              className="min-w-0 break-words text-right text-xs text-muted-foreground"
              dateTime={debtDate.toISOString()}
            >
              {format(debtDate, "dd.MM.yyyy", { locale: ru })}
            </time>

            <div className="flex min-w-0 items-start gap-1.5">
              <User className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words font-semibold">{debt.personName}</span>
            </div>

            <div className="min-w-0 break-words text-right text-sm font-semibold text-foreground">
              {formatMoney(debt.amount, debt.currency)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xs font-medium">{directionLabel}</div>
              </div>
              <span className="text-xs text-muted-foreground">{format(debtDate, "dd.MM.yyyy", { locale: ru })}</span>
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
