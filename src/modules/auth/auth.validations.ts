import { z } from "zod";

import { isUserAvatarSrc } from "@/shared/constants/user-avatars";

export const loginSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
  password: z.string().min(1, "Пароль обязателен"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Имя обязательно").max(100),
  email: z.string().email("Неверный адрес электронной почты"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export const registerFormSchema = z
  .object({
    name: z.string().min(1, "Имя обязательно").max(100),
    email: z.string().email("Неверный адрес электронной почты"),
    password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
    confirmPassword: z.string().min(1, "Подтверждение пароля обязательно"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, "Имя обязательно").max(100, "Имя не должно превышать 100 символов"),
  image: z
    .string()
    .nullable()
    .refine((value) => value === null || isUserAvatarSrc(value), "Выберите аватар из предложенного списка"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
