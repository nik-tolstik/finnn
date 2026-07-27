import { describe, expect, it } from "vitest";

import { CATEGORY_EMOJI_GROUPS, filterCategoryEmojiGroups } from "./category-emojis";

describe("category emoji catalog", () => {
  it("contains a broad catalog with searchable finance tags", () => {
    const emojiCount = CATEGORY_EMOJI_GROUPS.reduce((count, group) => count + group.emojis.length, 0);

    expect(emojiCount).toBeGreaterThanOrEqual(150);
    expect(filterCategoryEmojiGroups(CATEGORY_EMOJI_GROUPS, "DOLLAR")[0]?.emojis.map((item) => item.emoji)).toContain(
      "💵"
    );
    expect(
      filterCategoryEmojiGroups(CATEGORY_EMOJI_GROUPS, "  наличные  ")[0]?.emojis.map((item) => item.emoji)
    ).toEqual(expect.arrayContaining(["💰", "💵"]));
  });

  it("searches tags, group names, and normalized whitespace", () => {
    expect(filterCategoryEmojiGroups(CATEGORY_EMOJI_GROUPS, "  piggy   bank ")).toEqual([
      expect.objectContaining({
        label: "Финансы",
        emojis: expect.arrayContaining([expect.objectContaining({ emoji: "🐷" })]),
      }),
    ]);

    expect(filterCategoryEmojiGroups(CATEGORY_EMOJI_GROUPS, "транспорт")).toEqual([
      expect.objectContaining({ label: "Транспорт" }),
    ]);
  });

  it("returns no groups for an unknown search", () => {
    expect(filterCategoryEmojiGroups(CATEGORY_EMOJI_GROUPS, "неизвестный запрос")).toEqual([]);
  });
});
