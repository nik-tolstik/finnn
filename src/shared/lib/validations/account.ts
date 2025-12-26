import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  type: z.string().min(1, "Тип обязателен"),
  balance: z.string().min(1, "Баланс обязателен"),
  currency: z.string().min(1, "Валюта обязательна"),
  description: z.string().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100, "Название не должно превышать 100 символов").optional(),
  type: z.string().min(1, "Тип обязателен").optional(),
  balance: z.string().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

