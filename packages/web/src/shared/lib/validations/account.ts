import { z } from "zod";

import { Currency } from "@/shared/constants/currency";

const SIGNED_MONEY_PATTERN = /^-?\d+(?:\.\d+)?$/;
const INVALID_BALANCE_MESSAGE = "Баланс должен быть корректной суммой";

function isOptionalSignedMoney(value: string | undefined) {
  return value === undefined || value === "" || SIGNED_MONEY_PATTERN.test(value);
}

export const createAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  initialBalance: z
    .string()
    .min(1, "Изначальный баланс обязателен")
    .refine((value) => !value || SIGNED_MONEY_PATTERN.test(value), { message: INVALID_BALANCE_MESSAGE }),
  currency: z.nativeEnum(Currency),
  ownerId: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  createdAt: z.date(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100, "Название не должно превышать 100 символов").optional(),
  balance: z.string().optional().refine(isOptionalSignedMoney, { message: INVALID_BALANCE_MESSAGE }),
  initialBalance: z.string().optional().refine(isOptionalSignedMoney, { message: INVALID_BALANCE_MESSAGE }),
  currency: z.nativeEnum(Currency).optional(),
  ownerId: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  createdAt: z.date().optional(),
  order: z.number().optional(),
});

export const updateAccountsOrderSchema = z.object({
  accountOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
    })
  ),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type UpdateAccountsOrderInput = z.infer<typeof updateAccountsOrderSchema>;
