import { Module } from "@nestjs/common";

import { AuthModule } from "@/auth/auth.module";
import { EmailModule } from "@/email/email.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { TelegramBotClient } from "@/telegram-bot/telegram-bot.client";
import { TransactionsModule } from "@/transactions/transactions.module";
import { WorkspaceModule } from "@/workspace/workspace.module";

import { ScheduledPaymentsController } from "./scheduled-payments.controller";
import { ScheduledPaymentsService } from "./scheduled-payments.service";
import { ScheduledPaymentsCronController } from "./scheduled-payments-cron.controller";
import { ScheduledPaymentsNotificationService } from "./scheduled-payments-notification.service";
import { ScheduledPaymentsScheduleService } from "./scheduled-payments-schedule.service";

@Module({
  imports: [AuthModule, PrismaModule, WorkspaceModule, TransactionsModule, EmailModule],
  controllers: [ScheduledPaymentsController, ScheduledPaymentsCronController],
  providers: [
    ScheduledPaymentsService,
    ScheduledPaymentsScheduleService,
    ScheduledPaymentsNotificationService,
    TelegramBotClient,
  ],
  exports: [ScheduledPaymentsService, ScheduledPaymentsScheduleService],
})
export class ScheduledPaymentsModule {}
