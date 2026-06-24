import { describe, expect, it, vi } from "vitest";

import { ScheduledPaymentsService } from "../src/scheduled-payments/scheduled-payments.service";
import { ScheduledPaymentsNotificationService } from "../src/scheduled-payments/scheduled-payments-notification.service";
import { ScheduledPaymentsScheduleService } from "../src/scheduled-payments/scheduled-payments-schedule.service";

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  emailVerified: "2026-06-01T00:00:00.000Z",
  name: "Ada",
  image: null,
};

const workspace = {
  id: "workspace-1",
  name: "Home",
  baseCurrency: "BYN",
  ownerId: currentUser.id,
};

function createScheduledPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "scheduled-payment-1",
    workspaceId: workspace.id,
    name: "Internet",
    amountMode: "fixed",
    amount: "45",
    amountMin: null,
    amountMax: null,
    currency: "BYN",
    categoryId: "category-1",
    accountId: "account-1",
    assignedUserId: null,
    createdById: currentUser.id,
    scheduleKind: "monthly",
    scheduleInterval: 1,
    scheduleUnit: null,
    dueDay: 31,
    dueMonth: null,
    nextDueAt: new Date("2026-01-31T09:00:00.000Z"),
    timezone: "Europe/Minsk",
    reminderDaysBefore: [3, 0],
    notifyTelegram: true,
    notifyEmail: false,
    notes: null,
    lastPaidAt: null,
    snoozedUntil: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "record-1",
    scheduledPaymentId: "scheduled-payment-1",
    workspaceId: workspace.id,
    transactionId: null,
    dueAt: new Date("2026-01-31T09:00:00.000Z"),
    paidAt: null,
    skippedAt: null,
    amount: null,
    currency: "BYN",
    accountId: "account-1",
    categoryId: "category-1",
    actionById: currentUser.id,
    status: "skipped",
    note: null,
    createdAt: new Date("2026-01-31T10:00:00.000Z"),
    ...overrides,
  };
}

function createPrismaMock() {
  const mock = {
    $transaction: vi.fn(),
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    paymentTransaction: {
      findFirst: vi.fn(),
    },
    scheduledPayment: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scheduledPaymentRecord: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    scheduledPaymentReminderDelivery: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    telegramBotPreference: {
      findUnique: vi.fn(),
    },
  };

  mock.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      return input(mock);
    }

    return Promise.all(input as Array<Promise<unknown>>);
  });
  mock.workspace.findUnique.mockResolvedValue(workspace);
  mock.workspaceMember.findUnique.mockResolvedValue(null);
  mock.account.findFirst.mockResolvedValue({ id: "account-1" });
  mock.category.findFirst.mockResolvedValue({ id: "category-1" });
  mock.paymentTransaction.findFirst.mockResolvedValue({ id: "transaction-1" });

  return mock;
}

function createService(prisma = createPrismaMock()) {
  const schedule = new ScheduledPaymentsScheduleService();
  const transactions = {
    createPaymentTransaction: vi
      .fn()
      .mockResolvedValue({ transaction: { id: "transaction-1", account: { currency: "BYN" } } }),
  };
  const service = new ScheduledPaymentsService(prisma as never, transactions as never, schedule);
  return { prisma, schedule, service, transactions };
}

describe("Scheduled payments backend services", () => {
  it("clamps monthly recurrence to the last day of a shorter month", () => {
    const schedule = new ScheduledPaymentsScheduleService();

    const nextDueAt = schedule.getNextDueAt(new Date("2026-01-31T09:00:00.000Z"), {
      scheduleKind: "monthly",
      scheduleInterval: 1,
      dueDay: 31,
    });

    expect(nextDueAt?.toISOString()).toBe("2026-02-28T09:00:00.000Z");
  });

  it("lists scheduled payments and applies computed display status filters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T10:00:00.000Z"));
    const { prisma, service } = createService();
    prisma.scheduledPayment.findMany.mockResolvedValue([
      createScheduledPayment({
        id: "overdue",
        nextDueAt: new Date("2026-01-31T09:00:00.000Z"),
        records: [],
      }),
      createScheduledPayment({
        id: "future",
        nextDueAt: new Date("2026-02-10T09:00:00.000Z"),
        records: [],
      }),
    ]);

    const response = await service.listScheduledPayments(workspace.id, { displayStatus: "overdue" }, currentUser);

    expect(response.scheduledPayments.map((payment) => payment.id)).toEqual(["overdue"]);
    expect(response.total).toBe(1);
    expect(prisma.scheduledPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: workspace.id }),
      })
    );
    vi.useRealTimers();
  });

  it("marks a scheduled payment paid and uses TransactionsService when transaction creation is requested", async () => {
    const { prisma, service, transactions } = createService();
    const payment = createScheduledPayment();
    const record = createRecord({
      status: "paid",
      paidAt: new Date("2026-01-31T10:00:00.000Z"),
      transactionId: "transaction-1",
      amount: "45",
    });
    const updatedPayment = createScheduledPayment({
      nextDueAt: new Date("2026-02-28T09:00:00.000Z"),
      records: [record],
    });
    prisma.scheduledPayment.findFirst.mockResolvedValue(payment);
    prisma.scheduledPaymentRecord.create.mockResolvedValue(record);
    prisma.scheduledPayment.update.mockResolvedValue(updatedPayment);

    const response = await service.markPaid(
      workspace.id,
      payment.id,
      {
        amount: "45",
        paidAt: new Date("2026-01-31T10:00:00.000Z"),
        createTransaction: true,
      },
      currentUser
    );

    expect(transactions.createPaymentTransaction).toHaveBeenCalledWith(
      workspace.id,
      expect.objectContaining({
        accountId: "account-1",
        amount: "45",
        type: "expense",
      }),
      currentUser
    );
    expect(prisma.scheduledPaymentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "BYN", transactionId: "transaction-1" }),
      })
    );
    expect(response.transactionId).toBe("transaction-1");
    expect(response.scheduledPayment.nextDueAt).toBe("2026-02-28T09:00:00.000Z");
  });

  it("marks a scheduled payment paid with an existing transaction link", async () => {
    const { prisma, service, transactions } = createService();
    const payment = createScheduledPayment();
    const record = createRecord({
      status: "paid",
      paidAt: new Date("2026-01-31T10:00:00.000Z"),
      transactionId: "transaction-1",
      amount: "45",
    });
    const updatedPayment = createScheduledPayment({
      nextDueAt: new Date("2026-02-28T09:00:00.000Z"),
      records: [record],
    });
    prisma.scheduledPayment.findFirst.mockResolvedValue(payment);
    prisma.scheduledPaymentRecord.create.mockResolvedValue(record);
    prisma.scheduledPayment.update.mockResolvedValue(updatedPayment);

    const response = await service.markPaid(
      workspace.id,
      payment.id,
      {
        amount: "45",
        paidAt: new Date("2026-01-31T10:00:00.000Z"),
        transactionId: "transaction-1",
      },
      currentUser
    );

    expect(transactions.createPaymentTransaction).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.findFirst).toHaveBeenCalledWith({
      where: { id: "transaction-1", workspaceId: workspace.id, type: "expense" },
      select: { id: true },
    });
    expect(prisma.scheduledPaymentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transactionId: "transaction-1" }),
      })
    );
    expect(response.transactionId).toBe("transaction-1");
  });

  it("skips an occurrence and advances the due date without creating a transaction", async () => {
    const { prisma, service, transactions } = createService();
    const payment = createScheduledPayment();
    const record = createRecord();
    prisma.scheduledPayment.findFirst.mockResolvedValue(payment);
    prisma.scheduledPaymentRecord.create.mockResolvedValue(record);
    prisma.scheduledPayment.update.mockResolvedValue(
      createScheduledPayment({
        nextDueAt: new Date("2026-02-28T09:00:00.000Z"),
        records: [record],
      })
    );

    const response = await service.skip(workspace.id, payment.id, { note: "No bill" }, currentUser);

    expect(transactions.createPaymentTransaction).not.toHaveBeenCalled();
    expect(response.record.status).toBe("skipped");
    expect(response.scheduledPayment.nextDueAt).toBe("2026-02-28T09:00:00.000Z");
  });

  it("deletes a scheduled payment with records and reminder deliveries", async () => {
    const { prisma, service } = createService();
    const payment = createScheduledPayment();
    prisma.scheduledPayment.findFirst.mockResolvedValue(payment);

    await service.deleteScheduledPayment(workspace.id, payment.id, currentUser);

    expect(prisma.scheduledPaymentReminderDelivery.deleteMany).toHaveBeenCalledWith({
      where: { scheduledPaymentId: payment.id, workspaceId: workspace.id },
    });
    expect(prisma.scheduledPaymentRecord.deleteMany).toHaveBeenCalledWith({
      where: { scheduledPaymentId: payment.id, workspaceId: workspace.id },
    });
    expect(prisma.scheduledPayment.delete).toHaveBeenCalledWith({ where: { id: payment.id } });
  });

  it("does not resend an already logged reminder delivery", async () => {
    const { prisma, schedule, service } = createService();
    const email = { sendScheduledPaymentReminderEmail: vi.fn() };
    const telegram = { sendMessage: vi.fn() };
    const notificationService = new ScheduledPaymentsNotificationService(
      prisma as never,
      email as never,
      telegram as never,
      schedule,
      service
    );
    prisma.scheduledPayment.findMany.mockResolvedValue([
      {
        ...createScheduledPayment({
          nextDueAt: new Date("2026-02-04T09:00:00.000Z"),
          reminderDaysBefore: [3],
        }),
        workspace: { name: workspace.name },
      },
    ]);
    prisma.scheduledPaymentReminderDelivery.findUnique.mockResolvedValue({ id: "delivery-1" });

    const response = await notificationService.runReminderCron(new Date("2026-02-01T12:00:00.000Z"));

    expect(prisma.scheduledPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { snoozedUntil: null },
                { snoozedUntil: { isSet: false } },
                { snoozedUntil: { lte: expect.any(Date) } },
              ],
            },
          ],
        }),
      })
    );
    expect(response).toMatchObject({ processed: 0, sent: 0, failed: 0, deliveries: [] });
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(prisma.scheduledPaymentReminderDelivery.create).not.toHaveBeenCalled();
  });
});
