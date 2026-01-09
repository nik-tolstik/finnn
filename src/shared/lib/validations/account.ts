import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  balance: z.string().min(1, "Баланс обязателен"),
  currency: z.enum(["BYN", "USD", "EUR"]),
  ownerId: z.string().min(1, "Владелец обязателен"),
  color: z.string().optional(),
  icon: z.string().optional(),
  createdAt: z.date(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100, "Название не должно превышать 100 символов").optional(),
  balance: z.string().optional(),
  currency: z.enum(["BYN", "USD", "EUR"]).optional(),
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
