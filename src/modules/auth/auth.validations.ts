import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
  password: z.string().min(1, "Пароль обязателен"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Имя обязательно").max(100),
  email: z.string().email("Неверный адрес электронной почты"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export type LoginInput = z.infer<typeof loginSchema>;
const imageSchema = z.union([
  z.string().refine(
    (val) => {
      if (val.startsWith("/")) {
        return true;
      }
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Неверный URL изображения" }
  ),
  z.null(),
]).nullable();

export const updateUserSchema = z.object({
  name: z.string().min(1, "Имя обязательно").max(100, "Имя не должно превышать 100 символов"),
  image: z.preprocess(
    (val) => {
      return val === "" || val === undefined ? null : val;
    },
    imageSchema
  ) as z.ZodType<string | null>,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
