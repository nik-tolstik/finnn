import { beforeEach, describe, expect, it, vi } from "vitest";

const updateApiScheduledPaymentMock = vi.fn();

vi.mock("@/shared/api/generated/scheduled-payments/scheduled-payments", () => ({
  createScheduledPayment: vi.fn(),
  deleteScheduledPayment: vi.fn(),
  getScheduledPaymentHistory: vi.fn(),
  listScheduledPayments: vi.fn(),
  markScheduledPaymentPaid: vi.fn(),
  skipScheduledPayment: vi.fn(),
  snoozeScheduledPayment: vi.fn(),
  updateScheduledPayment: updateApiScheduledPaymentMock,
}));

function createScheduledPaymentDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "scheduled-payment-1",
    workspaceId: "workspace-1",
    name: "Internet",
    amountMode: "fixed",
    amount: "45",
    amountMin: null,
    amountMax: null,
    currency: "BYN",
    categoryId: null,
    accountId: null,
    assignedUserId: null,
    createdById: "user-1",
    displayStatus: "upcoming",
    scheduleKind: "weekly",
    scheduleInterval: 1,
    scheduleUnit: null,
    dueDay: null,
    dueMonth: null,
    nextDueAt: "2026-06-22T09:00:00.000Z",
    timezone: "Europe/Minsk",
    reminderDaysBefore: [3, 0],
    notifyTelegram: false,
    notifyEmail: true,
    notes: null,
    lastPaidAt: null,
    snoozedUntil: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("scheduled-payment.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves nullable cleared fields in update payloads", async () => {
    updateApiScheduledPaymentMock.mockResolvedValue({
      scheduledPayment: createScheduledPaymentDto(),
    });

    const { updateScheduledPayment } = await import("./scheduled-payment.api");
    const nextDueAt = new Date("2026-06-22T09:00:00.000Z");

    await updateScheduledPayment("workspace-1", "scheduled-payment-1", {
      accountId: null,
      amount: "45",
      amountMode: "fixed",
      assignedUserId: null,
      categoryId: null,
      currency: "BYN",
      dueDay: null,
      dueMonth: null,
      name: "Internet",
      nextDueAt,
      notes: null,
      scheduleKind: "weekly",
      scheduleInterval: 1,
      scheduleUnit: null,
    });

    expect(updateApiScheduledPaymentMock).toHaveBeenCalledWith(
      "workspace-1",
      "scheduled-payment-1",
      expect.objectContaining({
        accountId: null,
        assignedUserId: null,
        categoryId: null,
        dueDay: null,
        dueMonth: null,
        nextDueAt: nextDueAt.toISOString(),
        notes: null,
        scheduleUnit: null,
      }),
      undefined
    );
  });
});
