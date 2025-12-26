import { z } from "zod";

export const createDebtSchema = z
  .object({
    accountId: z.string().optional(),
    type: z.enum(["lent", "borrowed"]),
    debtorName: z.string().min(1, "Имя должника обязательно").max(100),
    amount: z.string().min(1, "Сумма обязательна"),
    description: z.string().optional(),
    dueDate: z.date().optional(),
    status: z.enum(["pending", "paid", "cancelled"]),
    useAccount: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.useAccount) {
        return data.accountId && data.accountId.length > 0;
      }
      return true;
    },
    {
      message: "Счёт обязателен при использовании счёта",
      path: ["accountId"],
    }
  );

export const updateDebtSchema = z.object({
  accountId: z.string().min(1, "Счёт обязателен").optional(),
  type: z.enum(["lent", "borrowed"]).optional(),
  debtorName: z.string().min(1, "Имя должника обязательно").max(100).optional(),
  amount: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.date().optional().nullable(),
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
});

export const closeDebtSchema = z
  .object({
    paidAmount: z.string().min(1, "Сумма обязательна"),
    useAccount: z.boolean(),
    accountId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.useAccount) {
        return data.accountId && data.accountId.length > 0;
      }
      return true;
    },
    {
      message: "Счёт обязателен при использовании счёта",
      path: ["accountId"],
    }
  );

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type CloseDebtInput = z.infer<typeof closeDebtSchema>;

