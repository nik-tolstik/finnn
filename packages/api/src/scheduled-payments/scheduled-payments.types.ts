export const SCHEDULED_PAYMENT_AMOUNT_MODES = ["fixed", "unknown", "range"] as const;
export const SCHEDULED_PAYMENT_DISPLAY_STATUSES = ["upcoming", "due", "overdue", "paid", "skipped"] as const;
export const SCHEDULED_PAYMENT_RECORD_STATUSES = ["paid", "skipped"] as const;
export const SCHEDULED_PAYMENT_SCHEDULE_KINDS = ["one_time", "weekly", "monthly", "yearly", "custom"] as const;
export const SCHEDULED_PAYMENT_SCHEDULE_UNITS = ["days", "weeks", "months", "years"] as const;
export const SCHEDULED_PAYMENT_REMINDER_CHANNELS = ["telegram", "email"] as const;
export const SCHEDULED_PAYMENT_REMINDER_STATUSES = ["sent", "failed"] as const;

export type ScheduledPaymentAmountMode = (typeof SCHEDULED_PAYMENT_AMOUNT_MODES)[number];
export type ScheduledPaymentDisplayStatus = (typeof SCHEDULED_PAYMENT_DISPLAY_STATUSES)[number];
export type ScheduledPaymentRecordStatus = (typeof SCHEDULED_PAYMENT_RECORD_STATUSES)[number];
export type ScheduledPaymentScheduleKind = (typeof SCHEDULED_PAYMENT_SCHEDULE_KINDS)[number];
export type ScheduledPaymentScheduleUnit = (typeof SCHEDULED_PAYMENT_SCHEDULE_UNITS)[number];
export type ScheduledPaymentReminderChannel = (typeof SCHEDULED_PAYMENT_REMINDER_CHANNELS)[number];
export type ScheduledPaymentReminderStatus = (typeof SCHEDULED_PAYMENT_REMINDER_STATUSES)[number];

export const DEFAULT_SCHEDULED_PAYMENT_TIMEZONE = "Europe/Minsk";
export const SCHEDULED_PAYMENT_EXPENSE_TYPE = "expense";
