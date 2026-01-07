import { z } from "zod";

import { TransactionType } from "@/modules/transactions/transaction.constants";
import { CategoryType } from "@/modules/categories/category.constants";

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, "Счёт обязателен"),
  amount: z
    .string()
    .min(1, "Сумма обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  type: z.nativeEnum(TransactionType),
  description: z.string().optional(),
  date: z.date(),
  categoryId: z.string().optional(),
  newCategory: z
    .object({
      name: z.string().min(1, "Название категории обязательно"),
      color: z.string(),
      type: z.nativeEnum(CategoryType),
    })
    .optional(),
});

export const createTransferSchema = z.object({
  fromAccountId: z.string().min(1, "Счёт отправителя обязателен"),
  toAccountId: z.string().min(1, "Счёт получателя обязателен"),
  amount: z
    .string()
    .min(1, "Сумма отправления обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  toAmount: z
    .string()
    .min(1, "Сумма получения обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  description: z.string().optional(),
  date: z.date(),
});

export const updateTransactionSchema = z.object({
  amount: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  description: z.string().optional(),
  date: z.date().optional(),
  categoryId: z.string().optional().nullable(),
});

export const updateTransferSchema = z.object({
  fromAccountId: z.string().min(1, "Счёт отправителя обязателен"),
  toAccountId: z.string().min(1, "Счёт получателя обязателен"),
  amount: z
    .string()
    .min(1, "Сумма отправления обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  toAmount: z
    .string()
    .min(1, "Сумма получения обязательна")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Сумма должна быть больше 0" }
    ),
  description: z.string().optional(),
  date: z.date(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpdateTransferInput = z.infer<typeof updateTransferSchema>;

