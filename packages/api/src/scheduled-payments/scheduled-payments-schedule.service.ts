import { BadRequestException, Injectable } from "@nestjs/common";
import type { ScheduledPaymentRecord } from "@prisma/client";

import type {
  ScheduledPaymentDisplayStatus,
  ScheduledPaymentScheduleKind,
  ScheduledPaymentScheduleUnit,
} from "./scheduled-payments.types";

type ScheduleInput = {
  scheduleKind: ScheduledPaymentScheduleKind;
  scheduleInterval: number;
  scheduleUnit?: ScheduledPaymentScheduleUnit | null;
  dueDay?: number | null;
  dueMonth?: number | null;
};

type DisplayInput = {
  nextDueAt: Date;
  timezone?: string | null;
  lastRecord: ScheduledPaymentRecord | null;
};

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(day, daysInMonth(year, monthIndex));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number, preferredDay = date.getUTCDate()) {
  const targetMonthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const next = new Date(date);
  next.setUTCFullYear(targetYear, normalizedMonth, clampDay(targetYear, normalizedMonth, preferredDay));
  return next;
}

function addYears(
  date: Date,
  years: number,
  preferredMonth = date.getUTCMonth() + 1,
  preferredDay = date.getUTCDate()
) {
  const next = new Date(date);
  const targetYear = date.getUTCFullYear() + years;
  const monthIndex = preferredMonth - 1;
  next.setUTCFullYear(targetYear, monthIndex, clampDay(targetYear, monthIndex, preferredDay));
  return next;
}

function sameInstant(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

@Injectable()
export class ScheduledPaymentsScheduleService {
  validateSchedule(schedule: ScheduleInput) {
    if (schedule.scheduleInterval < 1) {
      throw new BadRequestException("Интервал повторения должен быть больше 0");
    }

    if (schedule.scheduleKind === "custom" && !schedule.scheduleUnit) {
      throw new BadRequestException("Укажите единицу произвольного интервала");
    }

    if (schedule.scheduleKind !== "custom" && schedule.scheduleUnit) {
      throw new BadRequestException("Единица интервала используется только для произвольного расписания");
    }

    if ((schedule.scheduleKind === "monthly" || schedule.scheduleUnit === "months") && !schedule.dueDay) {
      throw new BadRequestException("Укажите день месяца");
    }

    if (schedule.scheduleKind === "yearly" && (!schedule.dueDay || !schedule.dueMonth)) {
      throw new BadRequestException("Укажите день и месяц ежегодного платежа");
    }
  }

  getNextDueAt(currentDueAt: Date, schedule: ScheduleInput) {
    this.validateSchedule(schedule);
    const interval = Math.max(schedule.scheduleInterval || 1, 1);

    if (schedule.scheduleKind === "one_time") return null;
    if (schedule.scheduleKind === "weekly") return addDays(currentDueAt, interval * 7);
    if (schedule.scheduleKind === "monthly")
      return addMonths(currentDueAt, interval, schedule.dueDay ?? currentDueAt.getUTCDate());
    if (schedule.scheduleKind === "yearly") {
      return addYears(
        currentDueAt,
        interval,
        schedule.dueMonth ?? currentDueAt.getUTCMonth() + 1,
        schedule.dueDay ?? currentDueAt.getUTCDate()
      );
    }

    if (schedule.scheduleKind === "custom") {
      if (schedule.scheduleUnit === "days") return addDays(currentDueAt, interval);
      if (schedule.scheduleUnit === "weeks") return addDays(currentDueAt, interval * 7);
      if (schedule.scheduleUnit === "months")
        return addMonths(currentDueAt, interval, schedule.dueDay ?? currentDueAt.getUTCDate());
      if (schedule.scheduleUnit === "years") {
        return addYears(
          currentDueAt,
          interval,
          schedule.dueMonth ?? currentDueAt.getUTCMonth() + 1,
          schedule.dueDay ?? currentDueAt.getUTCDate()
        );
      }
    }

    throw new BadRequestException("Недопустимое расписание платежа");
  }

  getReminderDate(dueAt: Date, daysBefore: number) {
    return addDays(dueAt, -daysBefore);
  }

  getLocalDateKey(value: Date, timezone = "Europe/Minsk") {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone || "Europe/Minsk",
      year: "numeric",
    }).format(value);
  }

  getDisplayStatus(input: DisplayInput, now = new Date()): ScheduledPaymentDisplayStatus {
    if (input.lastRecord && sameInstant(input.lastRecord.dueAt, input.nextDueAt)) {
      if (input.lastRecord.status === "paid") return "paid";
      if (input.lastRecord.status === "skipped") return "skipped";
    }

    const dueKey = this.getLocalDateKey(input.nextDueAt, input.timezone || undefined);
    const todayKey = this.getLocalDateKey(now, input.timezone || undefined);
    if (dueKey === todayKey) return "due";
    return dueKey < todayKey ? "overdue" : "upcoming";
  }
}
