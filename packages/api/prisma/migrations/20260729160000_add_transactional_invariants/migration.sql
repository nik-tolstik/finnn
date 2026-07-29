DROP INDEX "scheduled_payment_records_scheduledPaymentId_dueAt_idx";

CREATE UNIQUE INDEX "scheduled_payment_records_scheduledPaymentId_dueAt_key"
ON "scheduled_payment_records"("scheduledPaymentId", "dueAt");
