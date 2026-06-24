import { z } from "zod";

import { CategoryType } from "@/modules/categories/category.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { optionalPositiveMoneyString, requiredPositiveMoneyString } from "@/shared/lib/validations/money";

export const createPaymentTransactionSchema = z.object({
  accountId: z.string().min(1, "Счёт обязателен"),
  amount: requiredPositiveMoneyString("Сумма обязательна"),
  type: z.nativeEnum(PaymentTransactionType),
  description: z.string().optional(),
  date: z.date(),
  categoryId: z.string().optional(),
  newCategory: z
    .object({
      name: z.string().min(1, "Название категории обязательно"),
      type: z.nativeEnum(CategoryType),
    })
    .optional(),
});

export const createTransferTransactionSchema = z.object({
  fromAccountId: z.string().min(1, "Счёт отправителя обязателен"),
  toAccountId: z.string().min(1, "Счёт получателя обязателен"),
  amount: requiredPositiveMoneyString("Сумма отправления обязательна"),
  toAmount: requiredPositiveMoneyString("Сумма получения обязательна"),
  description: z.string().optional(),
  date: z.date(),
});

export const updatePaymentTransactionSchema = z.object({
  accountId: z.string().optional(),
  amount: optionalPositiveMoneyString(),
  description: z.string().optional(),
  date: z.date().optional(),
  categoryId: z.string().optional().nullable(),
});

export const updateTransferTransactionSchema = z.object({
  fromAccountId: z.string().min(1, "Счёт отправителя обязателен"),
  toAccountId: z.string().min(1, "Счёт получателя обязателен"),
  amount: requiredPositiveMoneyString("Сумма отправления обязательна"),
  toAmount: requiredPositiveMoneyString("Сумма получения обязательна"),
  description: z.string().optional(),
  date: z.date(),
});

export type CreatePaymentTransactionInput = z.infer<typeof createPaymentTransactionSchema>;
export type CreateTransferTransactionInput = z.infer<typeof createTransferTransactionSchema>;
export type UpdatePaymentTransactionInput = z.infer<typeof updatePaymentTransactionSchema>;
export type UpdateTransferTransactionInput = z.infer<typeof updateTransferTransactionSchema>;
