import { z } from "zod";

import { DebtType } from "@/modules/debts/debt.constants";

export const createDebtSchema = z
  .object({
    type: z.nativeEnum(DebtType),
    personName: z.string().min(1, "Имя обязательно"),
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
    date: z.date(),
    useAccount: z.boolean(),
    accountId: z.string().optional(),
    currency: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.useAccount) {
        return !!data.accountId;
      }
      return !!data.currency;
    },
    {
      message: "Выберите счёт или валюту",
      path: ["accountId"],
    }
  );

export const closeDebtSchema = z
  .object({
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
    toAmount: z
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
    paymentAmount: z
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
    categoryId: z.string().optional(),
    closeEarly: z.boolean().optional(),
    accountId: z.string().optional(),
    useAccount: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.useAccount) {
        return !!data.accountId;
      }
      return true;
    },
    {
      message: "Выберите счёт",
      path: ["accountId"],
    }
  );

export const addToDebtSchema = z.object({
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
  useAccount: z.boolean(),
});

export const updateDebtSchema = z.object({
  personName: z.string().min(1, "Имя обязательно"),
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
  date: z.date(),
});

export const updateDebtTransactionSchema = z.object({
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
  toAmount: z
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
  accountId: z.string().optional(),
  date: z.date(),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type CloseDebtInput = z.infer<typeof closeDebtSchema>;
export type AddToDebtInput = z.infer<typeof addToDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type UpdateDebtTransactionInput = z.infer<typeof updateDebtTransactionSchema>;
