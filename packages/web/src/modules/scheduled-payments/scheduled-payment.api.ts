import type {
  CreateScheduledPaymentDto,
  ListScheduledPaymentsParams,
  MarkScheduledPaymentPaidDto,
  ScheduledPaymentRecordResponseDto,
  ScheduledPaymentResponseDto,
  SkipScheduledPaymentDto,
  SnoozeScheduledPaymentDto,
  UpdateScheduledPaymentDto,
} from "@/shared/api/generated/model";
import {
  createScheduledPayment as createApiScheduledPayment,
  deleteScheduledPayment as deleteApiScheduledPayment,
  getScheduledPaymentHistory as getApiScheduledPaymentHistory,
  listScheduledPayments as listApiScheduledPayments,
  markScheduledPaymentPaid as markApiScheduledPaymentPaid,
  skipScheduledPayment as skipApiScheduledPayment,
  snoozeScheduledPayment as snoozeApiScheduledPayment,
  updateScheduledPayment as updateApiScheduledPayment,
} from "@/shared/api/generated/scheduled-payments/scheduled-payments";
import { fail, ok, success } from "@/shared/lib/action-result";
import { normalizeMoneyString, normalizeOptionalMoneyString } from "@/shared/utils/money";

import type {
  MarkScheduledPaymentPaidInput,
  ScheduledPayment,
  ScheduledPaymentFilters,
  ScheduledPaymentFormInput,
} from "./scheduled-payment.types";

function toDate(value: string) {
  return new Date(value);
}

function toOptionalDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function toUiScheduledPayment(payment: ScheduledPaymentResponseDto): ScheduledPayment {
  return {
    ...payment,
    createdAt: toDate(payment.createdAt),
    lastPaidAt: toOptionalDate(payment.lastPaidAt),
    nextDueAt: toDate(payment.nextDueAt),
    snoozedUntil: toOptionalDate(payment.snoozedUntil),
    updatedAt: toDate(payment.updatedAt),
  };
}

function toCreateDto(input: ScheduledPaymentFormInput): CreateScheduledPaymentDto {
  return {
    ...input,
    accountId: input.accountId || undefined,
    amount: normalizeOptionalMoneyString(input.amount),
    amountMin: normalizeOptionalMoneyString(input.amountMin),
    amountMax: normalizeOptionalMoneyString(input.amountMax),
    assignedUserId: input.assignedUserId || undefined,
    categoryId: input.categoryId || undefined,
    dueDay: input.dueDay || undefined,
    dueMonth: input.dueMonth || undefined,
    nextDueAt: input.nextDueAt.toISOString(),
    notes: input.notes || undefined,
    scheduleUnit: input.scheduleUnit || undefined,
  };
}

function normalizeNullableMoneyString(amount?: string | null): string | null | undefined {
  if (amount === undefined) return undefined;
  if (amount === null) return null;

  const normalizedAmount = normalizeMoneyString(amount);
  return normalizedAmount || null;
}

function toUpdateDto(input: Partial<ScheduledPaymentFormInput>): UpdateScheduledPaymentDto {
  return {
    ...input,
    accountId: input.accountId === undefined ? undefined : input.accountId || null,
    amount: normalizeNullableMoneyString(input.amount),
    amountMin: normalizeNullableMoneyString(input.amountMin),
    amountMax: normalizeNullableMoneyString(input.amountMax),
    assignedUserId: input.assignedUserId === undefined ? undefined : input.assignedUserId || null,
    categoryId: input.categoryId === undefined ? undefined : input.categoryId || null,
    dueDay: input.dueDay === undefined ? undefined : input.dueDay,
    dueMonth: input.dueMonth === undefined ? undefined : input.dueMonth,
    nextDueAt: input.nextDueAt?.toISOString(),
    notes: input.notes === undefined ? undefined : input.notes || null,
    scheduleUnit: input.scheduleUnit === undefined ? undefined : input.scheduleUnit,
  };
}

function toMarkPaidDto(input: MarkScheduledPaymentPaidInput): MarkScheduledPaymentPaidDto {
  return {
    ...input,
    amount: normalizeMoneyString(input.amount),
    paidAt: input.paidAt.toISOString(),
  };
}

function toListParams(filters?: ScheduledPaymentFilters): ListScheduledPaymentsParams | undefined {
  if (!filters) return undefined;
  return {
    displayStatus: filters.displayStatus as ListScheduledPaymentsParams["displayStatus"],
  };
}

function toUiRecord(record: ScheduledPaymentRecordResponseDto) {
  return {
    ...record,
    createdAt: toDate(record.createdAt),
    dueAt: toDate(record.dueAt),
    paidAt: toOptionalDate(record.paidAt),
    skippedAt: toOptionalDate(record.skippedAt),
  };
}

export async function getScheduledPayments(
  workspaceId: string,
  filters?: ScheduledPaymentFilters,
  options?: RequestInit
) {
  const response = await listApiScheduledPayments(workspaceId, toListParams(filters), options);
  return {
    data: response.scheduledPayments.map(toUiScheduledPayment),
    total: response.total,
  };
}

export async function createScheduledPayment(
  workspaceId: string,
  input: ScheduledPaymentFormInput,
  options?: RequestInit
) {
  try {
    const response = await createApiScheduledPayment(workspaceId, toCreateDto(input), options);
    return ok(toUiScheduledPayment(response.scheduledPayment));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать платёж");
  }
}

export async function updateScheduledPayment(
  workspaceId: string,
  id: string,
  input: Partial<ScheduledPaymentFormInput>,
  options?: RequestInit
) {
  try {
    const response = await updateApiScheduledPayment(workspaceId, id, toUpdateDto(input), options);
    return ok(toUiScheduledPayment(response.scheduledPayment));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить платёж");
  }
}

export async function markScheduledPaymentPaid(
  workspaceId: string,
  id: string,
  input: MarkScheduledPaymentPaidInput,
  options?: RequestInit
) {
  try {
    const response = await markApiScheduledPaymentPaid(workspaceId, id, toMarkPaidDto(input), options);
    return ok({
      scheduledPayment: toUiScheduledPayment(response.scheduledPayment),
      transactionId: response.transactionId ?? null,
    });
  } catch (error: unknown) {
    return fail(error, "Не удалось отметить платёж оплаченным");
  }
}

export async function skipScheduledPayment(
  workspaceId: string,
  id: string,
  input: SkipScheduledPaymentDto = {},
  options?: RequestInit
) {
  try {
    await skipApiScheduledPayment(workspaceId, id, input, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось пропустить платёж");
  }
}

export async function snoozeScheduledPayment(
  workspaceId: string,
  id: string,
  input: SnoozeScheduledPaymentDto,
  options?: RequestInit
) {
  try {
    await snoozeApiScheduledPayment(workspaceId, id, input, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось отложить платёж");
  }
}

export async function deleteScheduledPayment(workspaceId: string, id: string, options?: RequestInit) {
  try {
    await deleteApiScheduledPayment(workspaceId, id, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить платёж");
  }
}

export async function getScheduledPaymentHistory(workspaceId: string, id: string, options?: RequestInit) {
  try {
    const response = await getApiScheduledPaymentHistory(workspaceId, id, options);
    return ok(response.records.map(toUiRecord));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить историю платежа");
  }
}
