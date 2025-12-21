import { z } from "zod";

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["income", "expense", "transfer"]),
  description: z.string().optional(),
  date: z.date().default(new Date()),
  categoryId: z.string().optional(),
});

export const createTransferSchema = z.object({
  fromAccountId: z.string().min(1, "From account is required"),
  toAccountId: z.string().min(1, "To account is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
  date: z.date().default(new Date()),
});

export const updateTransactionSchema = z.object({
  amount: z.string().optional(),
  description: z.string().optional(),
  date: z.date().optional(),
  categoryId: z.string().optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

