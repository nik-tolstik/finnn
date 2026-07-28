const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ACCEPTED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CategoryIconUploadCandidate = Pick<File, "size" | "type">;

export function getCategoryIconUploadError(file: CategoryIconUploadCandidate | null): string | null {
  if (!file) return "Выберите изображение";
  if (!ACCEPTED_UPLOAD_TYPES.has(file.type)) return "Поддерживаются PNG, JPEG и WebP изображения";
  if (file.size > MAX_UPLOAD_BYTES) return "Размер изображения не должен превышать 2 MB";
  return null;
}

export function resolveCategoryIconUploadSelection<TFile extends CategoryIconUploadCandidate>(file: TFile | null) {
  const error = getCategoryIconUploadError(file);

  return {
    error,
    selectedFile: error ? null : file,
  };
}
