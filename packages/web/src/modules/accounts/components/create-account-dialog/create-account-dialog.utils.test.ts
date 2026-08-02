import { describe, expect, it } from "vitest";

import { getCreateAccountPreviewBalance } from "./create-account-dialog.utils";

describe("create account dialog utils", () => {
  it("keeps complete signed balances in the account preview", () => {
    expect(getCreateAccountPreviewBalance("-100.25")).toBe("-100.25");
    expect(getCreateAccountPreviewBalance("0")).toBe("0");
    expect(getCreateAccountPreviewBalance("100.25")).toBe("100.25");
    expect(getCreateAccountPreviewBalance("12.")).toBe("12.");
    expect(getCreateAccountPreviewBalance("-12.")).toBe("-12.");
    expect(getCreateAccountPreviewBalance(".5")).toBe(".5");
    expect(getCreateAccountPreviewBalance("-.5")).toBe("-.5");
  });

  it("uses zero while the balance input is incomplete", () => {
    expect(getCreateAccountPreviewBalance(undefined)).toBe("0");
    expect(getCreateAccountPreviewBalance("")).toBe("0");
    expect(getCreateAccountPreviewBalance("-")).toBe("0");
    expect(getCreateAccountPreviewBalance("-.")).toBe("0");
    expect(getCreateAccountPreviewBalance(".")).toBe("0");
    expect(getCreateAccountPreviewBalance("--1")).toBe("0");
    expect(getCreateAccountPreviewBalance("1-2")).toBe("0");
    expect(getCreateAccountPreviewBalance("12.3.4")).toBe("0");
  });
});
