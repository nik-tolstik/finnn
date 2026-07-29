import { Inject, Injectable } from "@nestjs/common";
import type { ScheduledPayment } from "@prisma/client";

import { EmailService } from "@/email/email.service";
import { PrismaService } from "@/prisma/prisma.service";
import { TelegramBotClient } from "@/telegram-bot/telegram-bot.client";
import { encodeScheduledPaymentCallbackData } from "@/telegram-bot/telegram-callback-data";

import { ScheduledPaymentsService } from "./scheduled-payments.service";
import type { ScheduledPaymentReminderChannel } from "./scheduled-payments.types";
import { ScheduledPaymentsScheduleService } from "./scheduled-payments-schedule.service";

type ReminderCandidate = ScheduledPayment & {
  workspace: {
    name: string;
  };
};

type ReminderRecipient = {
  userId: string;
  email: string | null;
  emailVerified: Date | null;
  telegramChatId: string | null;
};

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function getTelegramReplyMarkup(paymentId: string, dueAt: Date) {
  return {
    inline_keyboard: [
      [
        { text: "Оплачено", callback_data: encodeScheduledPaymentCallbackData("paid", paymentId, dueAt) },
        { text: "Отложить", callback_data: encodeScheduledPaymentCallbackData("snooze", paymentId, dueAt, 1) },
        { text: "Пропустить", callback_data: encodeScheduledPaymentCallbackData("skip", paymentId, dueAt) },
      ],
    ],
  };
}

@Injectable()
export class ScheduledPaymentsNotificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(TelegramBotClient) private readonly telegram: TelegramBotClient,
    @Inject(ScheduledPaymentsScheduleService) private readonly schedule: ScheduledPaymentsScheduleService,
    @Inject(ScheduledPaymentsService) private readonly scheduledPayments: ScheduledPaymentsService
  ) {}

  async runReminderCron(now = new Date()) {
    const payments = await this.prisma.scheduledPayment.findMany({
      where: {
        reminderDaysBefore: { isEmpty: false },
        OR: [{ notifyEmail: true }, { notifyTelegram: true }],
        AND: [
          {
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
          },
        ],
      },
      include: {
        workspace: {
          select: { name: true },
        },
      },
      orderBy: { nextDueAt: "asc" },
      take: 200,
    });

    const deliveries = [];

    for (const payment of payments) {
      const channels: ScheduledPaymentReminderChannel[] = [];
      if (payment.notifyTelegram) channels.push("telegram");
      if (payment.notifyEmail) channels.push("email");

      for (const daysBefore of payment.reminderDaysBefore) {
        if (!this.shouldProcessReminder(payment, daysBefore, now)) continue;

        for (const channel of channels) {
          const delivery = await this.processReminderChannel(payment, daysBefore, channel);
          if (delivery) deliveries.push(delivery);
        }
      }
    }

    return {
      success: true,
      processed: deliveries.length,
      sent: deliveries.filter((delivery) => delivery.status === "sent").length,
      failed: deliveries.filter((delivery) => delivery.status === "failed").length,
      deliveries: deliveries.map((delivery) => this.scheduledPayments.toReminderDeliveryDto(delivery)),
    };
  }

  private shouldProcessReminder(payment: ReminderCandidate, daysBefore: number, now: Date) {
    const reminderDate = this.schedule.getReminderDate(payment.nextDueAt, daysBefore);
    const reminderKey = this.schedule.getLocalDateKey(reminderDate, payment.timezone);
    const todayKey = this.schedule.getLocalDateKey(now, payment.timezone);
    return reminderKey <= todayKey;
  }

  private async processReminderChannel(
    payment: ReminderCandidate,
    daysBefore: number,
    channel: ScheduledPaymentReminderChannel
  ) {
    const reminderDate = this.schedule.getReminderDate(payment.nextDueAt, daysBefore);
    const delivery = await this.claimReminderDelivery(payment, reminderDate, daysBefore, channel);
    if (!delivery) return null;

    const recipient = await this.getRecipient(payment);
    const sendResult = await this.sendReminder(payment, recipient, daysBefore, channel);

    return this.prisma.scheduledPaymentReminderDelivery.update({
      where: { id: delivery.id },
      data: {
        status: sendResult.ok ? "sent" : "failed",
        sentAt: sendResult.ok ? new Date() : null,
        error: sendResult.ok ? null : sendResult.error,
      },
    });
  }

  private async claimReminderDelivery(
    payment: ReminderCandidate,
    reminderDate: Date,
    daysBefore: number,
    channel: ScheduledPaymentReminderChannel
  ) {
    try {
      return await this.prisma.scheduledPaymentReminderDelivery.create({
        data: {
          scheduledPaymentId: payment.id,
          workspaceId: payment.workspaceId,
          userId: payment.assignedUserId || payment.createdById,
          dueAt: payment.nextDueAt,
          reminderDate,
          daysBefore,
          channel,
          status: "pending",
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  private async getRecipient(payment: ScheduledPayment): Promise<ReminderRecipient> {
    const userId = payment.assignedUserId || payment.createdById;
    const [user, preference] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          emailVerified: true,
        },
      }),
      this.prisma.telegramBotPreference.findUnique({
        where: { userId },
        select: { telegramChatId: true },
      }),
    ]);

    return {
      userId,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      telegramChatId: preference?.telegramChatId ?? null,
    };
  }

  private async sendReminder(
    payment: ReminderCandidate,
    recipient: ReminderRecipient,
    daysBefore: number,
    channel: ScheduledPaymentReminderChannel
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (channel === "telegram") {
      if (!recipient.telegramChatId) {
        return { ok: false, error: "Telegram не подключён" };
      }

      try {
        await this.telegram.sendMessage({
          chatId: recipient.telegramChatId,
          text: this.scheduledPayments.getReminderText(payment, payment.workspace.name, daysBefore),
          replyMarkup: getTelegramReplyMarkup(payment.id, payment.nextDueAt),
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Не удалось отправить Telegram" };
      }
    }

    if (!recipient.email || !recipient.emailVerified) {
      return { ok: false, error: "Email не подтверждён" };
    }

    const result = await this.email.sendScheduledPaymentReminderEmail({
      email: recipient.email,
      paymentName: payment.name,
      workspaceName: payment.workspace.name,
      dueAt: payment.nextDueAt,
      amountLabel: this.scheduledPayments.getAmountLabel(payment),
      scheduledPaymentId: payment.id,
    });

    return "success" in result ? { ok: true } : { ok: false, error: result.error };
  }
}
