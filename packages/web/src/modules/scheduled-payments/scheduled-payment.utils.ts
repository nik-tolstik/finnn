import { formatMoney } from "@/shared/utils/money";

import { SCHEDULED_PAYMENT_AMOUNT_MODE_LABELS, SCHEDULED_PAYMENT_SCHEDULE_LABELS } from "./scheduled-payment.constants";
import type { ScheduledPayment } from "./scheduled-payment.types";

export function getScheduledPaymentAmountLabel(
  payment: Pick<ScheduledPayment, "amount" | "amountMax" | "amountMin" | "amountMode" | "currency">
) {
  if (payment.amountMode === "fixed" && payment.amount && payment.currency) {
    return formatMoney(payment.amount, payment.currency);
  }

  if (payment.amountMode === "range" && payment.amountMin && payment.amountMax && payment.currency) {
    return `${formatMoney(payment.amountMin, payment.currency)} - ${formatMoney(payment.amountMax, payment.currency)}`;
  }

  return SCHEDULED_PAYMENT_AMOUNT_MODE_LABELS[payment.amountMode] ?? "Неизвестна";
}

export function getScheduledPaymentScheduleLabel(
  payment: Pick<ScheduledPayment, "scheduleInterval" | "scheduleKind" | "scheduleUnit">
) {
  if (payment.scheduleKind !== "custom") {
    return SCHEDULED_PAYMENT_SCHEDULE_LABELS[payment.scheduleKind] ?? payment.scheduleKind;
  }

  const unitLabel: Record<string, string> = {
    days: "дн.",
    weeks: "нед.",
    months: "мес.",
    years: "г.",
  };

  return `Каждые ${payment.scheduleInterval} ${unitLabel[payment.scheduleUnit || "days"]}`;
}

export function formatScheduledPaymentDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}
