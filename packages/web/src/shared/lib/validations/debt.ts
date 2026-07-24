import { z } from "zod";

import { DebtType } from "@/modules/debts/debt.constants";
import { optionalPositiveMoneyString, requiredPositiveMoneyString } from "@/shared/lib/validations/money";

export const createDebtSchema = z
  .object({
    type: z.nativeEnum(DebtType),
    personName: z.string().min(1, "Имя обязательно"),
    amount: requiredPositiveMoneyString("Сумма обязательна"),
    toAmount: optionalPositiveMoneyString(),
    date: z.date(),
    useAccount: z.boolean(),
    accountId: z.string().optional(),
    currency: z.string().min(1, "Выберите валюту"),
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

export const closeDebtSchema = z
  .object({
    amount: requiredPositiveMoneyString("Сумма обязательна"),
    toAmount: optionalPositiveMoneyString(),
    paymentAmount: optionalPositiveMoneyString(),
    categoryId: z.string().optional(),
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
  amount: requiredPositiveMoneyString("Сумма обязательна"),
  toAmount: optionalPositiveMoneyString(),
  useAccount: z.boolean(),
  accountId: z.string().optional(),
});

export const updateDebtSchema = z.object({
  personName: z.string().min(1, "Имя обязательно"),
  amount: requiredPositiveMoneyString("Сумма обязательна"),
  toAmount: optionalPositiveMoneyString(),
  date: z.date(),
});

export const updateDebtTransactionSchema = z.object({
  amount: requiredPositiveMoneyString("Сумма обязательна"),
  toAmount: optionalPositiveMoneyString(),
  accountId: z.string().optional(),
  date: z.date(),
});

export const debtWriteOffSchema = z.object({
  amount: requiredPositiveMoneyString("Сумма обязательна"),
  toAmount: optionalPositiveMoneyString(),
  accountId: z.string().min(1, "Выберите счёт"),
  categoryId: z.string().min(1, "Выберите категорию"),
  date: z.date(),
  description: z.string().optional(),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type CloseDebtInput = z.infer<typeof closeDebtSchema>;
export type AddToDebtInput = z.infer<typeof addToDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type UpdateDebtTransactionInput = z.infer<typeof updateDebtTransactionSchema>;
export type DebtWriteOffInput = z.infer<typeof debtWriteOffSchema>;
