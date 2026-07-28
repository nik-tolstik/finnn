import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryIcon, isCategoryEmojiValue } from "./CategoryIcon";

describe("CategoryIcon", () => {
  it("uses the muted question-mark container for missing and unknown values", () => {
    const emptyMarkup = renderToStaticMarkup(createElement(CategoryIcon, { icon: null }));
    const unknownMarkup = renderToStaticMarkup(createElement(CategoryIcon, { icon: "old-unknown-icon" }));

    expect(emptyMarkup).toContain('aria-label="Иконка не выбрана"');
    expect(emptyMarkup).toContain('data-icon="square-help"');
    expect(emptyMarkup).toMatch(/^<span\b/);
    expect(unknownMarkup).toContain('aria-label="Иконка не выбрана"');
    expect(unknownMarkup).toMatch(/^<span\b/);
    expect(unknownMarkup).not.toContain("old-unknown-icon");
  });

  it("keeps legacy Lucide values and emoji values renderable", () => {
    const legacyMarkup = renderToStaticMarkup(createElement(CategoryIcon, { icon: "shopping-cart" }));
    const emojiMarkup = renderToStaticMarkup(createElement(CategoryIcon, { icon: "💵" }));

    expect(legacyMarkup).toContain("shopping-cart");
    expect(emojiMarkup).toContain("💵");
    expect(isCategoryEmojiValue("💵")).toBe(true);
    expect(isCategoryEmojiValue("unknown")).toBe(false);
  });
});
