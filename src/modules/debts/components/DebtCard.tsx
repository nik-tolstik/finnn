"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, User } from "lucide-react";

import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { DebtType, DebtStatus } from "../debt.constants";
import type { DebtWithRelations } from "../debt.types";

interface DebtCardProps {
  debt: DebtWithRelations;
  onClick?: () => void;
}

export function DebtCard({ debt, onClick }: DebtCardProps) {
  const isLent = debt.type === DebtType.LENT;
  const isClosed = debt.status === DebtStatus.CLOSED;

  return (
    <AnimatedListItem>
      <Card
        className={cn("p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer", isClosed && "opacity-60")}
        onClick={onClick}
      >
        <div className="flex flex-col text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isClosed ? "secondary" : isLent ? "default" : "destructive"} className="text-xs">
                {isLent ? "Мне должны" : "Я должен"}
              </Badge>
              {isClosed && (
                <Badge variant="outline" className="text-xs">
                  Закрыт
                </Badge>
              )}
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
                  isLent ? "bg-success-primary/10" : "bg-error-primary/10"
                )}
              >
                {isLent ? (
                  <ArrowDownLeft className="size-4 text-success-primary" />
                ) : (
                  <ArrowUpRight className="size-4 text-error-primary" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{debt.personName}</span>
                </div>
                {debt.account && <span className="text-xs text-muted-foreground">Счёт: {debt.account.name}</span>}
              </div>
            </div>

            <div className="text-right">
              <div className={cn("font-medium", isLent ? "text-success-primary" : "text-error-primary")}>
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
      </Card>
    </AnimatedListItem>
  );
}
