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
  days?: number
) {
  return [SCHEDULED_PAYMENT_CALLBACK_PREFIX, action, scheduledPaymentId, days].filter(Boolean).join(":");
}

export function parseScheduledPaymentCallbackData(data: string | undefined): ParsedScheduledPaymentCallbackData {
  const [prefix, action, scheduledPaymentId, days] = (data || "").split(":");
  if (prefix !== SCHEDULED_PAYMENT_CALLBACK_PREFIX || !action || !scheduledPaymentId) {
    throw new BadRequestException("Unknown scheduled payment callback");
  }

  if (action !== "paid" && action !== "snooze" && action !== "skip") {
    throw new BadRequestException("Unknown scheduled payment callback action");
  }

  return {
    action,
    scheduledPaymentId,
    days: days ? Number.parseInt(days, 10) : undefined,
  };
}
