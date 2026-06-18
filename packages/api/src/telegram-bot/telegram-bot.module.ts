import { Module } from "@nestjs/common";

import { AiFinanceModule } from "@/ai-finance/ai-finance.module";
import { PrismaModule } from "@/prisma/prisma.module";

import { TelegramBotClient } from "./telegram-bot.client";
import { TelegramBotController } from "./telegram-bot.controller";
import { TelegramBotService } from "./telegram-bot.service";

@Module({
  imports: [AiFinanceModule, PrismaModule],
  controllers: [TelegramBotController],
  providers: [TelegramBotClient, TelegramBotService],
})
export class TelegramBotModule {}
