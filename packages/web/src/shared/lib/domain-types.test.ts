import { describe, expect, it } from "vitest";

import {
  asAccountId,
  asCurrencyCode,
  asDebtId,
  asMoneyAmount,
  asTransactionId,
  asWorkspaceId,
  makeCurrencyPair,
} from "./domain-types";

describe("domain type helpers", () => {
  it("preserves runtime string values for branded ids and money", () => {
    expect(asMoneyAmount("12.34")).toBe("12.34");
    expect(asAccountId("account-1")).toBe("account-1");
    expect(asWorkspaceId("workspace-1")).toBe("workspace-1");
    expect(asTransactionId("transaction-1")).toBe("transaction-1");
    expect(asDebtId("debt-1")).toBe("debt-1");
  });

  it("constructs currency pairs without changing wire values", () => {
    expect(asCurrencyCode("USD")).toBe("USD");
    expect(makeCurrencyPair("USD", "BYN")).toEqual({
      from: "USD",
      to: "BYN",
    });
  });
});
