"use client";

import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import type { AnalyticsCalendarResult } from "@/modules/analytics/analytics.types";
import {
  type AnalyticsCalendarCell,
  buildAnalyticsCalendarCells,
  getAnalyticsCalendarMonthKey,
} from "@/modules/analytics/analytics.view-model";
import type { TransactionViewFilters } from "@/modules/transactions/components/transactions-filters";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { PopoverTriggerRenderProps } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

import { AnalyticsDayDetails } from "./AnalyticsDayDetails";

type CalendarNavigationDirection = "previous" | "next";

interface AnalyticsCalendarProps {
  appliedFilters: TransactionViewFilters;
  calendar: AnalyticsCalendarResult;
  monthDate: Date;
  onMonthChange: (updater: (monthDate: Date) => Date) => void;
  workspaceId: string;
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_ENTER_DISTANCE = 32;
const MONTH_ENTER_TRANSITION = { type: "spring", stiffness: 360, damping: 34, mass: 0.82 } as const;

function getMonthNavigationDirection(sourceMonth: Date, targetMonth: Date): CalendarNavigationDirection {
  return targetMonth.getTime() < sourceMonth.getTime() ? "previous" : "next";
}

function parseCalendarDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function CalendarAmountLine({ className, isZero, value }: { className: string; isZero: boolean; value: string }) {
  return (
    <span className={cn("block max-w-full truncate text-[9px] font-semibold leading-none sm:text-xs", className)}>
      <span className={cn(isZero && "text-muted-foreground/60")}>{value}</span>
    </span>
  );
}

function CalendarCellButton({
  cell,
  onSelect,
  triggerProps,
}: {
  cell: AnalyticsCalendarCell;
  onSelect: (cell: AnalyticsCalendarCell) => void;
  triggerProps?: PopoverTriggerRenderProps;
}) {
  const { onClick: onTriggerClick, ref: triggerRef, ...popoverTriggerProps } = triggerProps ?? {};

  return (
    <button
      {...popoverTriggerProps}
      type="button"
      ref={triggerRef}
      className={cn(
        "group flex min-h-[62px] w-full min-w-0 flex-col items-start justify-between rounded-none border border-transparent bg-background p-1 text-left transition-[background-color,border-color,box-shadow] hover:bg-accent/35 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 sm:min-h-[96px] sm:rounded-md sm:p-2",
        !cell.isCurrentMonth && "bg-muted/20 text-muted-foreground/55 opacity-75",
        cell.isSelected && "border-primary bg-primary/8 ring-2 ring-primary/35",
        cell.isToday && !cell.isSelected && "border-primary/55"
      )}
      onClick={(event) => {
        onTriggerClick?.(event);
        if (cell.date && !triggerProps) {
          onSelect(cell);
        }
      }}
      aria-label={
        cell.date
          ? `${cell.dayNumber} число, доход ${cell.incomeLabel}, расход ${cell.expenseLabel}, ${cell.transactionCount} операций`
          : "Пустая ячейка"
      }
    >
      <span className="flex w-full items-center justify-start gap-1 sm:justify-between">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:size-6 sm:text-xs",
            cell.isToday && "bg-primary text-primary-foreground",
            cell.isSelected && !cell.isToday && "bg-primary/12 text-primary"
          )}
        >
          {cell.dayNumber}
        </span>
        {cell.transactionCount > 0 ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold leading-none text-muted-foreground sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]">
            {cell.transactionCount}
          </span>
        ) : null}
      </span>
      {cell.hasActivity ? (
        <span className="min-w-0 max-w-full space-y-0.5">
          <CalendarAmountLine
            value={cell.incomeLabel}
            isZero={cell.incomeTotal === "0"}
            className="text-emerald-700 dark:text-emerald-300"
          />
          <CalendarAmountLine
            value={cell.expenseLabel}
            isZero={cell.expenseTotal === "0"}
            className="text-rose-700 dark:text-rose-300"
          />
        </span>
      ) : null}
    </button>
  );
}

function CalendarGrid({
  cells,
  onSelect,
  renderSelectedCell,
  selectedDate,
}: {
  cells: AnalyticsCalendarCell[];
  onSelect: (cell: AnalyticsCalendarCell) => void;
  renderSelectedCell?: (cell: AnalyticsCalendarCell) => ReactNode;
  selectedDate?: string | null;
}) {
  return (
    <div className="grid grid-cols-7 gap-0 sm:gap-2">
      {cells.map((cell) => {
        const selectedCell = cell.date === selectedDate && renderSelectedCell ? renderSelectedCell(cell) : null;

        return (
          <Fragment key={cell.date ?? `empty-${cell.dayNumber}`}>
            {selectedCell ?? <CalendarCellButton cell={cell} onSelect={onSelect} />}
          </Fragment>
        );
      })}
    </div>
  );
}

export function AnalyticsCalendar({
  appliedFilters,
  calendar,
  monthDate,
  onMonthChange,
  workspaceId,
}: AnalyticsCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingSelectedDate, setPendingSelectedDate] = useState<string | null>(null);
  const { isMobile } = useBreakpoints();
  const prefersReducedMotion = useReducedMotion();
  const animationDirectionRef = useRef<CalendarNavigationDirection>("next");
  const visibleMonth = monthDate;
  const visibleMonthKey = getAnalyticsCalendarMonthKey(visibleMonth);
  const currentMonth = startOfMonth(new Date());
  const cells = useMemo(
    () =>
      buildAnalyticsCalendarCells({
        calendar,
        monthDate: visibleMonth,
        selectedDate,
      }),
    [calendar, selectedDate, visibleMonth]
  );
  const selectedDay = cells.find((cell) => cell.date === selectedDate) ?? null;

  useEffect(() => {
    if (!pendingSelectedDate) {
      return;
    }

    const pendingMonthKey = getAnalyticsCalendarMonthKey(startOfMonth(parseCalendarDate(pendingSelectedDate)));
    if (pendingMonthKey !== visibleMonthKey) {
      return;
    }

    const pendingCell = cells.find((cell) => cell.date === pendingSelectedDate && cell.isCurrentMonth);
    if (pendingCell) {
      setSelectedDate(pendingSelectedDate);
      setPendingSelectedDate(null);
    }
  }, [cells, pendingSelectedDate, visibleMonthKey]);

  const handleMonthStep = (direction: CalendarNavigationDirection) => {
    animationDirectionRef.current = direction;
    setSelectedDate(null);
    setPendingSelectedDate(null);
    onMonthChange((monthDate) => {
      const normalizedMonth = startOfMonth(monthDate);
      return direction === "next" ? addMonths(normalizedMonth, 1) : subMonths(normalizedMonth, 1);
    });
  };

  const handleTodayClick = () => {
    setSelectedDate(null);
    setPendingSelectedDate(null);
    onMonthChange((monthDate) => {
      const normalizedMonth = startOfMonth(monthDate);
      animationDirectionRef.current = getMonthNavigationDirection(normalizedMonth, currentMonth);
      return currentMonth;
    });
  };

  const handleCellSelect = (cell: AnalyticsCalendarCell) => {
    if (!cell.date) {
      return;
    }

    if (cell.isCurrentMonth) {
      setPendingSelectedDate(null);
      setSelectedDate(cell.date);
      return;
    }

    const targetMonth = startOfMonth(parseCalendarDate(cell.date));
    animationDirectionRef.current = getMonthNavigationDirection(visibleMonth, targetMonth);
    setSelectedDate(null);
    setPendingSelectedDate(cell.date);
    onMonthChange(() => targetMonth);
  };

  const dayDetails = selectedDay ? (
    <AnalyticsDayDetails
      appliedFilters={appliedFilters}
      day={selectedDay}
      open={Boolean(selectedDate)}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedDate(null);
        }
      }}
      trigger={
        isMobile
          ? undefined
          : (triggerProps: PopoverTriggerRenderProps) => (
              <CalendarCellButton cell={selectedDay} onSelect={handleCellSelect} triggerProps={triggerProps} />
            )
      }
      workspaceId={workspaceId}
    />
  ) : null;

  const monthInitialState = prefersReducedMotion
    ? { opacity: 0 }
    : {
        opacity: 0,
        x: animationDirectionRef.current === "next" ? MONTH_ENTER_DISTANCE : -MONTH_ENTER_DISTANCE,
      };
  const monthAnimateState = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 };
  const monthTransition = prefersReducedMotion ? ({ duration: 0 } as const) : MONTH_ENTER_TRANSITION;

  return (
    <>
      <Card>
        <CardHeader className="gap-4 pb-3">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 lg:justify-start">
              <CardTitle className="text-xl">Календарь</CardTitle>
              <div className="flex shrink-0 items-center gap-1 lg:ml-3">
                <Button type="button" variant="secondary" size="sm" onClick={handleTodayClick}>
                  Сегодня
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => {
                    handleMonthStep("previous");
                  }}
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => {
                    handleMonthStep("next");
                  }}
                  aria-label="Следующий месяц"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{format(visibleMonth, "LLLL yyyy", { locale: ru })}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 gap-0 text-center text-[11px] font-medium text-muted-foreground sm:gap-2 sm:text-xs">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="mt-1.5 overflow-hidden">
            <motion.div
              key={visibleMonthKey}
              initial={monthInitialState}
              animate={monthAnimateState}
              transition={monthTransition}
            >
              <CalendarGrid
                cells={cells}
                onSelect={handleCellSelect}
                renderSelectedCell={isMobile ? undefined : () => dayDetails}
                selectedDate={isMobile ? null : selectedDate}
              />
            </motion.div>
          </div>
        </CardContent>
      </Card>

      {isMobile ? dayDetails : null}
    </>
  );
}
