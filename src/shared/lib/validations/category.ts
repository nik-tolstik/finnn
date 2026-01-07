import { z } from "zod";

import { CategoryType } from "@/modules/categories/category.constants";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  type: z.nativeEnum(CategoryType),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(CategoryType).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
