import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  slug: z
    .string()
    .min(1, "Slug обязателен")
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug может содержать только строчные буквы, цифры и дефисы"
    ),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  icon: z.string().optional().nullable(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
