import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Prisma,
  ScheduledPayment,
  ScheduledPaymentRecord,
  ScheduledPaymentReminderDelivery,
} from "@prisma/client";
import Big from "big.js";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";
import { TransactionsService } from "@/transactions/transactions.service";

import type {
  CreateScheduledPaymentDto,
  MarkScheduledPaymentPaidDto,
  ScheduledPaymentsQueryDto,
  SkipScheduledPaymentDto,
  SnoozeScheduledPaymentDto,
  UpdateScheduledPaymentDto,
} from "./scheduled-payments.dto";
import {
  DEFAULT_SCHEDULED_PAYMENT_TIMEZONE,
  SCHEDULED_PAYMENT_EXPENSE_TYPE,
  type ScheduledPaymentDisplayStatus,
  type ScheduledPaymentScheduleKind,
  type ScheduledPaymentScheduleUnit,
} from "./scheduled-payments.types";
import { ScheduledPaymentsScheduleService } from "./scheduled-payments-schedule.service";

type PrismaTx = Prisma.TransactionClient;
type ScheduledPaymentWithLastRecord = ScheduledPayment & {
  records?: ScheduledPaymentRecord[];
};

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toNullableIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function compareMoney(a: string, b: string): number {
  const bigA = new Big(a);
  const bigB = new Big(b);
  if (bigA.gt(bigB)) return 1;
  if (bigA.lt(bigB)) return -1;
  return 0;
}

function getAmountLabel(
  payment: Pick<ScheduledPayment, "amountMode" | "amount" | "amountMin" | "amountMax" | "currency">
) {
  if (payment.amountMode === "fixed" && payment.amount) return `${payment.amount} ${payment.currency || ""}`.trim();
  if (payment.amountMode === "range" && payment.amountMin && payment.amountMax) {
    return `${payment.amountMin}-${payment.amountMax} ${payment.currency || ""}`.trim();
  }
  return "сумма не указана";
}

function buildScheduledPaymentWhere(
  workspaceId: string,
  query: ScheduledPaymentsQueryDto
): Prisma.ScheduledPaymentWhereInput {
  const where: Prisma.ScheduledPaymentWhereInput = { workspaceId };

  if (query.assignedUserIds?.length) where.assignedUserId = { in: query.assignedUserIds };
  if (query.accountIds?.length) where.accountId = { in: query.accountIds };
  if (query.categoryIds?.length) where.categoryId = { in: query.categoryIds };

  const nextDueAt: Prisma.DateTimeFilter = {};
  if (query.dueFrom) nextDueAt.gte = query.dueFrom;
  if (query.dueTo) nextDueAt.lte = query.dueTo;
  if (Object.keys(nextDueAt).length > 0) where.nextDueAt = nextDueAt;

  return where;
}

@Injectable()
export class ScheduledPaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
    @Inject(ScheduledPaymentsScheduleService) private readonly schedule: ScheduledPaymentsScheduleService
  ) {}

  private toScheduledPaymentDto(payment: ScheduledPaymentWithLastRecord, now = new Date()) {
    const lastRecord = payment.records?.[0] ?? null;
    const displayStatus = this.schedule.getDisplayStatus(
      {
        nextDueAt: payment.nextDueAt,
        timezone: payment.timezone,
        lastRecord,
      },
      now
    );

    return {
      id: payment.id,
      workspaceId: payment.workspaceId,
      name: payment.name,
      amountMode: payment.amountMode,
      amount: payment.amount,
      amountMin: payment.amountMin,
      amountMax: payment.amountMax,
      currency: payment.currency,
      categoryId: payment.categoryId,
      accountId: payment.accountId,
      assignedUserId: payment.assignedUserId,
      createdById: payment.createdById,
      displayStatus,
      scheduleKind: payment.scheduleKind,
      scheduleInterval: payment.scheduleInterval,
      scheduleUnit: payment.scheduleUnit,
      dueDay: payment.dueDay,
      dueMonth: payment.dueMonth,
      nextDueAt: toIsoString(payment.nextDueAt),
      timezone: payment.timezone,
      reminderDaysBefore: payment.reminderDaysBefore,
      notifyTelegram: payment.notifyTelegram,
      notifyEmail: payment.notifyEmail,
      notes: payment.notes,
      lastPaidAt: toNullableIsoString(payment.lastPaidAt),
      snoozedUntil: toNullableIsoString(payment.snoozedUntil),
      createdAt: toIsoString(payment.createdAt),
      updatedAt: toIsoString(payment.updatedAt),
    };
  }

  toScheduledPaymentRecordDto(record: ScheduledPaymentRecord) {
    return {
      id: record.id,
      scheduledPaymentId: record.scheduledPaymentId,
      workspaceId: record.workspaceId,
      transactionId: record.transactionId,
      dueAt: toIsoString(record.dueAt),
      paidAt: toNullableIsoString(record.paidAt),
      skippedAt: toNullableIsoString(record.skippedAt),
      amount: record.amount,
      currency: record.currency,
      accountId: record.accountId,
      categoryId: record.categoryId,
      actionById: record.actionById,
      status: record.status,
      note: record.note,
      createdAt: toIsoString(record.createdAt),
    };
  }

  toReminderDeliveryDto(delivery: ScheduledPaymentReminderDelivery) {
    return {
      id: delivery.id,
      scheduledPaymentId: delivery.scheduledPaymentId,
      workspaceId: delivery.workspaceId,
      userId: delivery.userId,
      dueAt: toIsoString(delivery.dueAt),
      reminderDate: toIsoString(delivery.reminderDate),
      daysBefore: delivery.daysBefore,
      channel: delivery.channel,
      status: delivery.status,
      sentAt: toNullableIsoString(delivery.sentAt),
      error: delivery.error,
      createdAt: toIsoString(delivery.createdAt),
    };
  }

  private async assertWorkspaceAccess(workspaceId: string, currentUser: AuthenticatedUser) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    if (workspace.ownerId === currentUser.id) {
      return;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("Доступ запрещён");
    }
  }

  private async getWorkspaceBaseCurrency(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    return workspace.baseCurrency;
  }

  private validateAmount(input: {
    amountMode: string;
    amount?: string | null;
    amountMin?: string | null;
    amountMax?: string | null;
    currency?: string | null;
  }) {
    if (input.amountMode === "fixed") {
      if (!input.amount) throw new BadRequestException("Для фиксированной суммы укажите amount");
      return;
    }

    if (input.amountMode === "range") {
      if (!input.amountMin || !input.amountMax) {
        throw new BadRequestException("Для диапазона укажите amountMin и amountMax");
      }

      if (compareMoney(input.amountMin, input.amountMax) > 0) {
        throw new BadRequestException("Минимальная сумма не может быть больше максимальной");
      }
      return;
    }

    if (input.amountMode === "unknown") {
      return;
    }

    throw new BadRequestException("Недопустимый режим суммы");
  }

  private async assertAccountBelongsToWorkspace(accountId: string | null | undefined, workspaceId: string) {
    if (!accountId) return;

    const account = await this.prisma.account.findFirst({
      where: { id: accountId, workspaceId, archived: false },
      select: { id: true },
    });

    if (!account) {
      throw new BadRequestException("Счёт не найден");
    }
  }

  private async assertCategoryBelongsToWorkspace(categoryId: string | null | undefined, workspaceId: string) {
    if (!categoryId) return;

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, workspaceId, type: SCHEDULED_PAYMENT_EXPENSE_TYPE },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException("Категория не найдена или не является расходной");
    }
  }

  private async assertPaymentTransactionBelongsToWorkspace(
    transactionId: string | null | undefined,
    workspaceId: string
  ) {
    if (!transactionId) return;

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { id: transactionId, workspaceId, type: SCHEDULED_PAYMENT_EXPENSE_TYPE },
      select: { id: true },
    });

    if (!transaction) {
      throw new BadRequestException("Транзакция не найдена");
    }
  }

  private async assertUserBelongsToWorkspace(userId: string | null | undefined, workspaceId: string) {
    if (!userId) return;

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) throw new NotFoundException("Рабочий стол не найден");
    if (workspace.ownerId === userId) return;

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException("Ответственный должен быть участником рабочего стола");
    }
  }

  private getScheduleInput(input: {
    scheduleKind: string;
    scheduleInterval?: number | null;
    scheduleUnit?: string | null;
    dueDay?: number | null;
    dueMonth?: number | null;
  }) {
    return {
      scheduleKind: input.scheduleKind as ScheduledPaymentScheduleKind,
      scheduleInterval: input.scheduleInterval ?? 1,
      scheduleUnit: input.scheduleUnit as ScheduledPaymentScheduleUnit | null | undefined,
      dueDay: input.dueDay,
      dueMonth: input.dueMonth,
    };
  }

  private getCreateDueParts(input: CreateScheduledPaymentDto) {
    const dueDate = input.nextDueAt;
    const usesMonthlyAnchor =
      input.scheduleKind === "monthly" ||
      input.scheduleKind === "yearly" ||
      (input.scheduleKind === "custom" && (input.scheduleUnit === "months" || input.scheduleUnit === "years"));
    const usesYearlyAnchor =
      input.scheduleKind === "yearly" || (input.scheduleKind === "custom" && input.scheduleUnit === "years");

    return {
      dueDay: input.dueDay ?? (usesMonthlyAnchor ? dueDate.getUTCDate() : null),
      dueMonth: input.dueMonth ?? (usesYearlyAnchor ? dueDate.getUTCMonth() + 1 : null),
    };
  }

  async listScheduledPayments(workspaceId: string, query: ScheduledPaymentsQueryDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const payments = await this.prisma.scheduledPayment.findMany({
      where: buildScheduledPaymentWhere(workspaceId, query),
      include: {
        records: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ nextDueAt: "asc" }, { createdAt: "desc" }],
    });

    const mapped = payments.map((payment) => this.toScheduledPaymentDto(payment));
    const filtered = query.displayStatus
      ? mapped.filter((payment) => payment.displayStatus === query.displayStatus)
      : mapped;
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;

    return {
      scheduledPayments: filtered.slice(skip, skip + take),
      total: filtered.length,
    };
  }

  async createScheduledPayment(workspaceId: string, input: CreateScheduledPaymentDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);
    const dueParts = this.getCreateDueParts(input);
    const scheduleInput = this.getScheduleInput({ ...input, ...dueParts });
    this.schedule.validateSchedule(scheduleInput);
    this.validateAmount(input);
    await Promise.all([
      this.assertAccountBelongsToWorkspace(input.accountId, workspaceId),
      this.assertCategoryBelongsToWorkspace(input.categoryId, workspaceId),
      this.assertUserBelongsToWorkspace(input.assignedUserId, workspaceId),
    ]);

    const needsCurrency = input.amountMode !== "unknown";
    const currency = input.currency ?? (needsCurrency ? await this.getWorkspaceBaseCurrency(workspaceId) : null);

    const payment = await this.prisma.scheduledPayment.create({
      data: {
        workspaceId,
        name: input.name,
        amountMode: input.amountMode,
        amount: input.amount ?? null,
        amountMin: input.amountMin ?? null,
        amountMax: input.amountMax ?? null,
        currency,
        categoryId: input.categoryId ?? null,
        accountId: input.accountId ?? null,
        assignedUserId: input.assignedUserId ?? null,
        createdById: currentUser.id,
        scheduleKind: input.scheduleKind,
        scheduleInterval: input.scheduleInterval ?? 1,
        scheduleUnit: input.scheduleUnit ?? null,
        dueDay: dueParts.dueDay,
        dueMonth: dueParts.dueMonth,
        nextDueAt: input.nextDueAt,
        timezone: input.timezone ?? DEFAULT_SCHEDULED_PAYMENT_TIMEZONE,
        reminderDaysBefore: [...new Set(input.reminderDaysBefore ?? [])].sort((a, b) => b - a),
        notifyTelegram: input.notifyTelegram ?? false,
        notifyEmail: input.notifyEmail ?? false,
        notes: input.notes ?? null,
      },
    });

    return { scheduledPayment: this.toScheduledPaymentDto(payment) };
  }

  async getScheduledPayment(workspaceId: string, id: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const payment = await this.prisma.scheduledPayment.findFirst({
      where: { id, workspaceId },
      include: {
        records: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!payment) {
      throw new NotFoundException("Платёж не найден");
    }

    return { scheduledPayment: this.toScheduledPaymentDto(payment) };
  }

  async updateScheduledPayment(
    workspaceId: string,
    id: string,
    input: UpdateScheduledPaymentDto,
    currentUser: AuthenticatedUser
  ) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const existing = await this.prisma.scheduledPayment.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException("Платёж не найден");

    const next = { ...existing, ...input };
    this.validateAmount(next);
    this.schedule.validateSchedule(this.getScheduleInput(next));
    await Promise.all([
      this.assertAccountBelongsToWorkspace(input.accountId, workspaceId),
      this.assertCategoryBelongsToWorkspace(input.categoryId, workspaceId),
      this.assertUserBelongsToWorkspace(input.assignedUserId, workspaceId),
    ]);

    const payment = await this.prisma.scheduledPayment.update({
      where: { id },
      data: {
        name: input.name,
        amountMode: input.amountMode,
        amount: input.amount,
        amountMin: input.amountMin,
        amountMax: input.amountMax,
        currency: input.currency,
        categoryId: input.categoryId,
        accountId: input.accountId,
        assignedUserId: input.assignedUserId,
        scheduleKind: input.scheduleKind,
        scheduleInterval: input.scheduleInterval,
        scheduleUnit: input.scheduleUnit,
        dueDay: input.dueDay,
        dueMonth: input.dueMonth,
        nextDueAt: input.nextDueAt,
        timezone: input.timezone,
        reminderDaysBefore:
          input.reminderDaysBefore === undefined
            ? undefined
            : [...new Set(input.reminderDaysBefore)].sort((a, b) => b - a),
        notifyTelegram: input.notifyTelegram,
        notifyEmail: input.notifyEmail,
        notes: input.notes,
      },
      include: {
        records: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return { scheduledPayment: this.toScheduledPaymentDto(payment) };
  }

  async deleteScheduledPayment(workspaceId: string, id: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);
    await this.ensurePayment(workspaceId, id);

    await this.prisma.$transaction([
      this.prisma.scheduledPaymentReminderDelivery.deleteMany({ where: { scheduledPaymentId: id, workspaceId } }),
      this.prisma.scheduledPaymentRecord.deleteMany({ where: { scheduledPaymentId: id, workspaceId } }),
      this.prisma.scheduledPayment.delete({ where: { id } }),
    ]);
  }

  async markPaid(workspaceId: string, id: string, input: MarkScheduledPaymentPaidDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const payment = await this.ensurePayment(workspaceId, id);

    const accountId = input.accountId ?? payment.accountId;
    const categoryId = input.categoryId ?? payment.categoryId;
    if (input.createTransaction && !accountId) {
      throw new BadRequestException("Для создания транзакции выберите счёт");
    }
    if (input.createTransaction && input.transactionId) {
      throw new BadRequestException("Передайте createTransaction или transactionId, но не оба поля");
    }

    await Promise.all([
      this.assertAccountBelongsToWorkspace(accountId, workspaceId),
      this.assertCategoryBelongsToWorkspace(categoryId, workspaceId),
      this.assertPaymentTransactionBelongsToWorkspace(input.transactionId, workspaceId),
    ]);

    let transactionId = input.transactionId ?? null;
    let currency = input.currency ?? payment.currency;

    if (input.createTransaction) {
      const createdTransaction = await this.transactionsService.createPaymentTransaction(
        workspaceId,
        {
          accountId: accountId || "",
          amount: input.amount,
          type: SCHEDULED_PAYMENT_EXPENSE_TYPE,
          description: input.note || payment.name,
          date: input.paidAt,
          categoryId: categoryId ?? undefined,
        },
        currentUser
      );

      transactionId = createdTransaction.transaction.id;
      currency = createdTransaction.transaction.account.currency ?? currency;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const nextDueAt = this.schedule.getNextDueAt(payment.nextDueAt, this.getScheduleInput(payment));
      const record = await tx.scheduledPaymentRecord.create({
        data: {
          scheduledPaymentId: payment.id,
          workspaceId,
          transactionId,
          dueAt: payment.nextDueAt,
          paidAt: input.paidAt,
          amount: input.amount,
          currency,
          accountId: accountId ?? null,
          categoryId: categoryId ?? null,
          actionById: currentUser.id,
          status: "paid",
          note: input.note,
        },
      });

      const updatedPayment = await this.advancePaymentAfterAction(tx, payment, nextDueAt, {
        lastPaidAt: input.paidAt,
      });

      return { record, scheduledPayment: updatedPayment };
    });

    return {
      scheduledPayment: this.toScheduledPaymentDto(result.scheduledPayment),
      record: this.toScheduledPaymentRecordDto(result.record),
      transactionId,
    };
  }

  async skip(workspaceId: string, id: string, input: SkipScheduledPaymentDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);
    const payment = await this.ensurePayment(workspaceId, id);

    const result = await this.prisma.$transaction(async (tx) => {
      const nextDueAt = this.schedule.getNextDueAt(payment.nextDueAt, this.getScheduleInput(payment));
      const record = await tx.scheduledPaymentRecord.create({
        data: {
          scheduledPaymentId: payment.id,
          workspaceId,
          dueAt: payment.nextDueAt,
          skippedAt: new Date(),
          amount: null,
          currency: payment.currency,
          accountId: payment.accountId,
          categoryId: payment.categoryId,
          actionById: currentUser.id,
          status: "skipped",
          note: input.note,
        },
      });
      const updatedPayment = await this.advancePaymentAfterAction(tx, payment, nextDueAt);
      return { record, scheduledPayment: updatedPayment };
    });

    return {
      scheduledPayment: this.toScheduledPaymentDto(result.scheduledPayment),
      record: this.toScheduledPaymentRecordDto(result.record),
    };
  }

  async snooze(workspaceId: string, id: string, input: SnoozeScheduledPaymentDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);
    await this.ensurePayment(workspaceId, id);

    const snoozedUntil = new Date();
    snoozedUntil.setUTCDate(snoozedUntil.getUTCDate() + input.days);

    const payment = await this.prisma.scheduledPayment.update({
      where: { id },
      data: { snoozedUntil },
      include: {
        records: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return { scheduledPayment: this.toScheduledPaymentDto(payment) };
  }

  async getHistory(workspaceId: string, id: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);
    await this.ensurePayment(workspaceId, id);

    const records = await this.prisma.scheduledPaymentRecord.findMany({
      where: { scheduledPaymentId: id, workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return { records: records.map((record) => this.toScheduledPaymentRecordDto(record)) };
  }

  async markPaidFromTelegram(scheduledPaymentId: string, currentUser: AuthenticatedUser) {
    const payment = await this.prisma.scheduledPayment.findUnique({ where: { id: scheduledPaymentId } });
    if (!payment) throw new NotFoundException("Платёж не найден");
    if (payment.amountMode !== "fixed" || !payment.amount) {
      throw new BadRequestException("Укажите сумму платежа в Finnn");
    }

    return this.markPaid(
      payment.workspaceId,
      payment.id,
      {
        amount: payment.amount,
        currency: payment.currency ?? undefined,
        paidAt: new Date(),
        createTransaction: false,
      },
      currentUser
    );
  }

  async skipFromTelegram(scheduledPaymentId: string, currentUser: AuthenticatedUser) {
    const payment = await this.prisma.scheduledPayment.findUnique({ where: { id: scheduledPaymentId } });
    if (!payment) throw new NotFoundException("Платёж не найден");
    return this.skip(payment.workspaceId, payment.id, {}, currentUser);
  }

  async snoozeFromTelegram(scheduledPaymentId: string, days: number, currentUser: AuthenticatedUser) {
    const payment = await this.prisma.scheduledPayment.findUnique({ where: { id: scheduledPaymentId } });
    if (!payment) throw new NotFoundException("Платёж не найден");
    return this.snooze(payment.workspaceId, payment.id, { days }, currentUser);
  }

  private async ensurePayment(workspaceId: string, id: string) {
    const payment = await this.prisma.scheduledPayment.findFirst({ where: { id, workspaceId } });
    if (!payment) throw new NotFoundException("Платёж не найден");
    return payment;
  }

  private async advancePaymentAfterAction(
    tx: PrismaTx,
    payment: ScheduledPayment,
    nextDueAt: Date | null,
    extraData: Prisma.ScheduledPaymentUpdateInput = {}
  ) {
    const data: Prisma.ScheduledPaymentUpdateInput = {
      ...extraData,
      snoozedUntil: null,
    };

    if (nextDueAt) {
      data.nextDueAt = nextDueAt;
    }

    return tx.scheduledPayment.update({
      where: { id: payment.id },
      data,
      include: {
        records: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  getReminderText(payment: ScheduledPayment, workspaceName: string, daysBefore: number) {
    const amount = this.getAmountLabel(payment);
    const dueDate = this.schedule.getLocalDateKey(payment.nextDueAt, payment.timezone);
    const lead = daysBefore === 0 ? "сегодня" : `через ${daysBefore} дн.`;
    return [
      `Платёж «${payment.name}» ${lead}.`,
      `Срок: ${dueDate}.`,
      `Сумма: ${amount}.`,
      `Рабочий стол: ${workspaceName}.`,
    ].join("\n");
  }

  getAmountLabel(payment: Pick<ScheduledPayment, "amountMode" | "amount" | "amountMin" | "amountMax" | "currency">) {
    return getAmountLabel(payment);
  }

  getDisplayStatus(
    payment: ScheduledPayment,
    lastRecord: ScheduledPaymentRecord | null,
    now = new Date()
  ): ScheduledPaymentDisplayStatus {
    return this.schedule.getDisplayStatus(
      {
        nextDueAt: payment.nextDueAt,
        timezone: payment.timezone,
        lastRecord,
      },
      now
    );
  }
}
