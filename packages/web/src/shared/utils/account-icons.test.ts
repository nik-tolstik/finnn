import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ACCOUNT_ICON_DEFINITIONS, AccountIcon, getAccountIconDefinition } from "./account-icons";

describe("account icon definitions", () => {
  it("classifies currentColor icons as adaptive and fixed-color marks as brand icons", () => {
    expect(ACCOUNT_ICON_DEFINITIONS.Wallet.colorMode).toBe("adaptive");
    expect(ACCOUNT_ICON_DEFINITIONS.Visa.colorMode).toBe("adaptive");
    expect(ACCOUNT_ICON_DEFINITIONS.Mastercard.colorMode).toBe("brand");
    expect(ACCOUNT_ICON_DEFINITIONS.Belkart.colorMode).toBe("brand");
    expect(ACCOUNT_ICON_DEFINITIONS.Mir.colorMode).toBe("brand");
  });

  it("falls back to the default adaptive icon for unknown values", () => {
    expect(getAccountIconDefinition("unknown")).toBe(ACCOUNT_ICON_DEFINITIONS.HandCoins);
  });

  it("renders adaptive color variables without adding a surface to brand marks", () => {
    const adaptiveMarkup = renderToStaticMarkup(
      createElement(AccountIcon, { iconName: "Wallet", accountColor: "#ffffff", className: "size-5" })
    );
    const brandMarkup = renderToStaticMarkup(
      createElement(AccountIcon, { iconName: "Mir", accountColor: "#ffffff", className: "size-5" })
    );

    expect(adaptiveMarkup).toContain("account-icon-adaptive");
    expect(adaptiveMarkup).toContain("--account-icon-color-light");
    expect(brandMarkup).not.toContain("account-icon-brand");
    expect(brandMarkup).not.toContain("account-icon-adaptive");
    expect(brandMarkup).toContain('viewBox="0 0 809 229"');
  });
});
