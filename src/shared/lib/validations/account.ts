import { Currency } from "@prisma/client";
import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  balance: z.string().min(1, "Баланс обязателен"),
  currency: z.nativeEnum(Currency),
  ownerId: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  createdAt: z.date(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100, "Название не должно превышать 100 символов").optional(),
  balance: z.string().optional(),
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
