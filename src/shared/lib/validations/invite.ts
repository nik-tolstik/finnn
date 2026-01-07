import { z } from "zod";

export const createInviteSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
  expiresInDays: z.number().min(1).max(30).default(7),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
