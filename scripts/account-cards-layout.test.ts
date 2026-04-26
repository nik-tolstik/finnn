import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const expectedAccountsGridClass = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";

function readProjectFile(filePath: string) {
  return readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("account cards layout", () => {
  test("uses fixed thirds on large screens for account cards and skeletons", () => {
    const accountsCards = readProjectFile("src/modules/accounts/components/accounts-cards/AccountsCards.tsx");
    const accountsCardsSkeleton = readProjectFile(
      "src/modules/accounts/components/accounts-cards-skeleton/AccountsCardsSkeleton.tsx"
    );

    expect(accountsCards).toContain(expectedAccountsGridClass);
    expect(accountsCardsSkeleton).toContain(expectedAccountsGridClass);
  });
});
