import type { AuthUserResponseDto } from "@/shared/api/generated/model";
import { apiClient } from "@/shared/api/http-client";

export async function uploadCurrentUserAvatar(file: File, options?: RequestInit): Promise<AuthUserResponseDto> {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient<AuthUserResponseDto>("/auth/user/avatar", {
    ...options,
    method: "POST",
    body: formData,
  });
}

export async function deleteCurrentUserAvatar(options?: RequestInit): Promise<AuthUserResponseDto> {
  return apiClient<AuthUserResponseDto>("/auth/user/avatar", {
    ...options,
    method: "DELETE",
  });
}
