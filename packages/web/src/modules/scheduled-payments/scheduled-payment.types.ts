import type { ScheduledPaymentResponseDto } from "@/shared/api/generated/model";

export type ScheduledPayment = Omit<
  ScheduledPaymentResponseDto,
  "createdAt" | "lastPaidAt" | "nextDueAt" | "snoozedUntil" | "updatedAt"
> & {
  createdAt: Date;
  lastPaidAt: Date | null;
  nextDueAt: Date;
  snoozedUntil: Date | null;
  updatedAt: Date;
};

export interface ScheduledPaymentFilters {
  displayStatus?: string;
}

export interface ScheduledPaymentFormInput {
  name: string;
  amountMode: "fixed" | "unknown" | "range";
  amount?: string;
  amountMin?: string;
  amountMax?: string;
  currency?: string;
  categoryId?: string | null;
  accountId?: string | null;
  assignedUserId?: string | null;
  scheduleKind: "one_time" | "weekly" | "monthly" | "yearly" | "custom";
  scheduleInterval?: number;
  scheduleUnit?: "days" | "weeks" | "months" | "years" | null;
  dueDay?: number | null;
  dueMonth?: number | null;
  nextDueAt: Date;
  timezone?: string;
  reminderDaysBefore?: number[];
  notifyTelegram?: boolean;
  notifyEmail?: boolean;
  notes?: string | null;
}

export interface MarkScheduledPaymentPaidInput {
  amount: string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  paidAt: Date;
  createTransaction?: boolean;
  note?: string;
  transactionId?: string;
}
