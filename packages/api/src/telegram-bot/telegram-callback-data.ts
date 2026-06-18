import { BadRequestException } from "@nestjs/common";

export const TELEGRAM_CALLBACK_PREFIX = "ai";

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
