import { z } from "zod";

import { isUserAvatarSrc } from "@/shared/constants/user-avatars";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function isUploadedUserAvatarSrc(value: string): boolean {
  return /^\/auth\/users\/[^/]+\/avatar$/.test(value);
}

export function getAvatarUploadValidationError(file: Pick<File, "size" | "type"> | null | undefined): string | null {
  if (!file) return "Выберите файл аватара";
  if (file.size <= 0) return "Файл аватара пуст";
  if (file.size > AVATAR_MAX_BYTES) return "Файл аватара слишком большой";
  if (!AVATAR_UPLOAD_MIME_TYPES.includes(file.type as (typeof AVATAR_UPLOAD_MIME_TYPES)[number])) {
    return "Загрузите PNG, JPEG или WebP изображение";
  }
  return null;
}

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

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
});

export const passwordResetConfirmSchema = z
  .object({
    email: z.string().email("Неверный адрес электронной почты"),
    code: z.string().regex(/^\d{6}$/, "Введите 6 цифр"),
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
    .refine(
      (value) => value === null || isUserAvatarSrc(value) || isUploadedUserAvatarSrc(value),
      "Выберите аватар из предложенного списка"
    ),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
