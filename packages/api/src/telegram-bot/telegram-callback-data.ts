import { BadRequestException } from "@nestjs/common";

export const TELEGRAM_CALLBACK_PREFIX = "ai";
export const SCHEDULED_PAYMENT_CALLBACK_PREFIX = "sp";

export type TelegramCallbackAction =
  | "confirm"
  | "cancel"
  | "workspace"
  | "account"
  | "mode-single"
  | "mode-category"
  | "mode-items";

export type ParsedTelegramCallbackData = {
  action: TelegramCallbackAction;
  draftId: string;
  value?: string;
};

export type ScheduledPaymentCallbackAction = "paid" | "snooze" | "skip";

export type ParsedScheduledPaymentCallbackData = {
  action: ScheduledPaymentCallbackAction;
  scheduledPaymentId: string;
  dueAt?: Date;
  days?: number;
};

export function encodeTelegramCallbackData(action: TelegramCallbackAction, draftId: string, value?: string) {
  return [TELEGRAM_CALLBACK_PREFIX, action, draftId, value].filter(Boolean).join(":");
}

export function parseTelegramCallbackData(data: string | undefined): ParsedTelegramCallbackData {
  const [prefix, action, draftId, value] = (data || "").split(":");
  if (prefix !== TELEGRAM_CALLBACK_PREFIX || !action || !draftId) {
    throw new BadRequestException("Unknown Telegram callback");
  }

  if (
    action !== "confirm" &&
    action !== "cancel" &&
    action !== "workspace" &&
    action !== "account" &&
    action !== "mode-single" &&
    action !== "mode-category" &&
    action !== "mode-items"
  ) {
    throw new BadRequestException("Unknown Telegram callback action");
  }

  return { action, draftId, value };
}

export function encodeScheduledPaymentCallbackData(
  action: ScheduledPaymentCallbackAction,
  scheduledPaymentId: string,
  dueAt: Date,
  days?: number
) {
  const occurrence = `d${dueAt.getTime().toString(36)}`;
  return [SCHEDULED_PAYMENT_CALLBACK_PREFIX, action, scheduledPaymentId, occurrence, days].filter(Boolean).join(":");
}

export function parseScheduledPaymentCallbackData(data: string | undefined): ParsedScheduledPaymentCallbackData {
  const [prefix, action, scheduledPaymentId, occurrenceOrDays, encodedDays] = (data || "").split(":");
  if (prefix !== SCHEDULED_PAYMENT_CALLBACK_PREFIX || !action || !scheduledPaymentId) {
    throw new BadRequestException("Unknown scheduled payment callback");
  }

  if (action !== "paid" && action !== "snooze" && action !== "skip") {
    throw new BadRequestException("Unknown scheduled payment callback action");
  }

  let dueAt: Date | undefined;
  let days: number | undefined;
  if (occurrenceOrDays?.startsWith("d")) {
    const timestamp = Number.parseInt(occurrenceOrDays.slice(1), 36);
    if (!Number.isFinite(timestamp)) {
      throw new BadRequestException("Unknown scheduled payment occurrence");
    }
    dueAt = new Date(timestamp);
    days = encodedDays ? Number.parseInt(encodedDays, 10) : undefined;
  } else {
    days = occurrenceOrDays ? Number.parseInt(occurrenceOrDays, 10) : undefined;
  }

  return {
    action,
    scheduledPaymentId,
    dueAt,
    days,
  };
}
