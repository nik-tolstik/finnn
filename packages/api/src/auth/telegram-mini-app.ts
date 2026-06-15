import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import type { TelegramClaims } from "./telegram-oidc.client";

const TELEGRAM_WEBAPP_SECRET_KEY = "WebAppData";
const DEFAULT_TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const TELEGRAM_WEBAPP_AUTH_CLOCK_SKEW_SECONDS = 60;

type TelegramMiniAppUser = {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  username?: unknown;
  photo_url?: unknown;
};

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new ServiceUnavailableException("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

function getTelegramWebAppAuthMaxAgeSeconds(): number {
  const configured = Number(process.env.TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getTelegramMiniAppDisplayName(user: TelegramMiniAppUser): string | undefined {
  const firstName = getString(user.first_name);
  const lastName = getString(user.last_name);
  return [firstName, lastName].filter(Boolean).join(" ") || undefined;
}

function getDataCheckString(params: URLSearchParams): string {
  return Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function validateHash(params: URLSearchParams, receivedHash: string): void {
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new UnauthorizedException("Telegram Mini App init data hash is invalid");
  }

  const secretKey = createHmac("sha256", TELEGRAM_WEBAPP_SECRET_KEY).update(getTelegramBotToken()).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(getDataCheckString(params)).digest("hex");
  const received = Buffer.from(receivedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");

  if (received.length !== calculated.length || !timingSafeEqual(received, calculated)) {
    throw new UnauthorizedException("Telegram Mini App init data hash is invalid");
  }
}

function validateAuthDate(authDateValue: string | null): void {
  if (!authDateValue) {
    throw new BadRequestException("Telegram Mini App init data auth_date is required");
  }

  const authDate = Number(authDateValue);
  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw new BadRequestException("Telegram Mini App init data auth_date is invalid");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (authDate > nowSeconds + TELEGRAM_WEBAPP_AUTH_CLOCK_SKEW_SECONDS) {
    throw new UnauthorizedException("Telegram Mini App init data auth_date is invalid");
  }

  if (nowSeconds - authDate > getTelegramWebAppAuthMaxAgeSeconds()) {
    throw new UnauthorizedException("Telegram Mini App init data has expired");
  }
}

function parseTelegramUser(userValue: string | null): TelegramMiniAppUser {
  if (!userValue) {
    throw new BadRequestException("Telegram Mini App init data user is required");
  }

  try {
    const user = JSON.parse(userValue) as TelegramMiniAppUser;
    if (!user || typeof user !== "object") {
      throw new BadRequestException("Telegram Mini App init data user is invalid");
    }
    return user;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Telegram Mini App init data user is invalid");
  }
}

function getTelegramUserId(user: TelegramMiniAppUser): string {
  if (typeof user.id !== "number" || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new BadRequestException("Telegram Mini App init data user id is invalid");
  }
  return String(user.id);
}

export function validateTelegramMiniAppInitData(initData: string): TelegramClaims {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new BadRequestException("Telegram Mini App init data hash is required");
  }

  validateHash(params, hash);
  validateAuthDate(params.get("auth_date"));

  const user = parseTelegramUser(params.get("user"));
  return {
    sub: getTelegramUserId(user),
    name: getTelegramMiniAppDisplayName(user),
    preferred_username: getString(user.username),
    picture: getString(user.photo_url),
  };
}
