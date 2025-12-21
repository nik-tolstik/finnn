import { z } from "zod";

export const createDebtSchema = z.object({
  fromUserId: z.string().min(1, "From user is required"),
  toUserId: z.string().min(1, "To user is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
  status: z.enum(["pending", "paid", "cancelled"]).default("pending"),
});

export const updateDebtSchema = z.object({
  amount: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;

