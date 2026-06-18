import { Body, Controller, Headers, HttpCode, Inject, Post, UnauthorizedException } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ApiErrorDto } from "@/common/api-error.dto";

import { TelegramWebhookResponseDto } from "./telegram-bot.dto";
import { TelegramBotService } from "./telegram-bot.service";
import type { TelegramUpdate } from "./telegram-update.types";

function getWebhookSecret(): string {
  return process.env.TELEGRAM_BOT_WEBHOOK_SECRET?.trim() || "";
}

@Controller("telegram")
@ApiTags("Telegram")
export class TelegramBotController {
  constructor(@Inject(TelegramBotService) private readonly telegramBotService: TelegramBotService) {}

  @Post("webhook")
  @HttpCode(200)
  @ApiOperation({ operationId: "handleTelegramWebhook", summary: "Receive Telegram bot webhook updates" })
  @ApiHeader({ name: "x-telegram-bot-api-secret-token", required: true })
  @ApiOkResponse({ type: TelegramWebhookResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async handleWebhook(
    @Headers("x-telegram-bot-api-secret-token") secretToken: string | undefined,
    @Body() update: TelegramUpdate
  ) {
    const expectedSecret = getWebhookSecret();
    if (!expectedSecret || secretToken !== expectedSecret) {
      throw new UnauthorizedException("Telegram webhook secret is invalid");
    }

    return this.telegramBotService.handleUpdate(update);
  }
}
