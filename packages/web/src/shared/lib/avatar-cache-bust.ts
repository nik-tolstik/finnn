const uploadedAvatarVersions = new Map<string, string>();

export function isUploadedAvatarPath(image: string | null | undefined): image is string {
  return typeof image === "string" && image.startsWith("/auth/users/");
}

export function bumpUploadedAvatarVersion(image: string | null | undefined): void {
  if (!isUploadedAvatarPath(image)) return;

  uploadedAvatarVersions.set(image, String(Date.now()));
}

export function getUploadedAvatarVersion(image: string): string | null {
  return uploadedAvatarVersions.get(image) ?? null;
}
