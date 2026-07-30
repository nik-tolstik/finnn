import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountsCardsSkeleton } from "./AccountsCardsSkeleton";

describe("AccountsCardsSkeleton", () => {
  it("keeps three lightweight mobile cards and reveals the desktop placeholders at md", () => {
    const markup = renderToStaticMarkup(<AccountsCardsSkeleton />);

    expect(markup.match(/bg-account-card/g)).toHaveLength(6);
    expect(markup.match(/hidden md:flex/g)).toHaveLength(3);
    expect(markup).not.toContain("cursor-pointer");
  });
});
