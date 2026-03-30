import { z } from "zod";

import { CategoryType } from "@/modules/categories/category.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

export const createPaymentTransactionSchema = z.object({
  accountId: z.string().min(1, "Счёт обязателен"),
  amount: z
    .string()
    .min(1, "Сумма обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !Number.isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
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
  amount: z
    .string()
    .min(1, "Сумма отправления обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !Number.isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  toAmount: z
    .string()
    .min(1, "Сумма получения обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !Number.isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  description: z.string().optional(),
  date: z.date(),
});

export const updatePaymentTransactionSchema = z.object({
  accountId: z.string().optional(),
  amount: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !Number.isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  description: z.string().optional(),
  date: z.date().optional(),
  categoryId: z.string().optional().nullable(),
});

export const updateTransferTransactionSchema = z.object({
  fromAccountId: z.string().min(1, "Счёт отправителя обязателен"),
  toAccountId: z.string().min(1, "Счёт получателя обязателен"),
  amount: z
    .string()
    .min(1, "Сумма отправления обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !Number.isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  toAmount: z
    .string()
    .min(1, "Сумма получения обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !Number.isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  description: z.string().optional(),
  date: z.date(),
});

export type CreatePaymentTransactionInput = z.infer<typeof createPaymentTransactionSchema>;
export type CreateTransferTransactionInput = z.infer<typeof createTransferTransactionSchema>;
export type UpdatePaymentTransactionInput = z.infer<typeof updatePaymentTransactionSchema>;
export type UpdateTransferTransactionInput = z.infer<typeof updateTransferTransactionSchema>;
