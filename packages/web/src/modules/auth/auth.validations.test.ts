import { describe, expect, it } from "vitest";

import { getAvatarUploadValidationError, updateUserSchema } from "./auth.validations";

describe("auth validations", () => {
  it("accepts default, preset, and uploaded stable avatar values", () => {
    expect(updateUserSchema.safeParse({ name: "Ada", image: null }).success).toBe(true);
    expect(updateUserSchema.safeParse({ name: "Ada", image: "/avatars/animals/cat-01.svg" }).success).toBe(true);
    expect(updateUserSchema.safeParse({ name: "Ada", image: "/auth/users/user-1/avatar" }).success).toBe(true);
  });

  it("rejects arbitrary avatar values", () => {
    expect(updateUserSchema.safeParse({ name: "Ada", image: "https://example.com/avatar.png" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ name: "Ada", image: "/auth/users/user-1/avatar/extra" }).success).toBe(false);
  });

  it("validates avatar upload file shape", () => {
    expect(getAvatarUploadValidationError({ size: 10, type: "image/png" })).toBeNull();
    expect(getAvatarUploadValidationError(null)).toBe("Выберите файл аватара");
    expect(getAvatarUploadValidationError({ size: 0, type: "image/png" })).toBe("Файл аватара пуст");
    expect(getAvatarUploadValidationError({ size: 3 * 1024 * 1024, type: "image/png" })).toBe(
      "Файл аватара слишком большой"
    );
    expect(getAvatarUploadValidationError({ size: 10, type: "image/svg+xml" })).toBe(
      "Загрузите PNG, JPEG или WebP изображение"
    );
  });
});
