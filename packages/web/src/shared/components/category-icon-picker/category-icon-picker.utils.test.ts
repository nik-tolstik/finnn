import { describe, expect, it } from "vitest";

import { getCategoryIconUploadError, resolveCategoryIconUploadSelection } from "./category-icon-picker.utils";

describe("resolveCategoryIconUploadSelection", () => {
  it("clears the selected file when a replacement fails validation", () => {
    const invalidReplacement = {
      size: 1024,
      type: "image/gif",
    } as File;

    expect(resolveCategoryIconUploadSelection(invalidReplacement)).toEqual({
      error: "Поддерживаются PNG, JPEG и WebP изображения",
      selectedFile: null,
    });
  });

  it("keeps a valid supported file selected", () => {
    const validFile = {
      size: 1024,
      type: "image/png",
    } as File;

    expect(getCategoryIconUploadError(validFile)).toBeNull();
    expect(resolveCategoryIconUploadSelection(validFile)).toEqual({
      error: null,
      selectedFile: validFile,
    });
  });
});
