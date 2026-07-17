import type { ScheduledPaymentFormInitialValues } from "@/modules/scheduled-payments/scheduled-payment.types";

import { PaymentTransactionType } from "../../../transaction.constants";
import type { PaymentTransactionWithRelations } from "../../../transaction.types";
import type { ActionableCombinedTransaction } from "../types";

export function canCreateScheduledPaymentFromTransaction(
  transaction: ActionableCombinedTransaction
): transaction is Extract<ActionableCombinedTransaction, { kind: "paymentTransaction" }> {
  return transaction.kind === "paymentTransaction" && transaction.data.type === PaymentTransactionType.EXPENSE;
}

export function getScheduledPaymentInitialValues(
  transaction: PaymentTransactionWithRelations
): ScheduledPaymentFormInitialValues {
  return {
    name: transaction.description?.trim() || "Новый платёж",
    amount: transaction.amount,
    currency: transaction.account.currency,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    nextDueAt: new Date(transaction.date),
    scheduleKind: "one_time",
  };
}
