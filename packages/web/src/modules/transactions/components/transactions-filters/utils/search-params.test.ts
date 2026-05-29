import { describe, expect, it } from "vitest";

import {
  applyTransactionFiltersToSearchParams,
  countActiveTransactionFilterGroups,
  normalizeTransactionFilters,
  parseTransactionFilters,
} from "./search-params";

describe("shared transaction filter search params", () => {
  it("round-trips the same query contract for dashboard and analytics views", () => {
    const initialSearchParams = new URLSearchParams();
    initialSearchParams.append("userId", "user-2");
    initialSearchParams.append("userId", "user-1");
    initialSearchParams.append("transactionType", "expense");
    initialSearchParams.append("transactionType", "income");
    initialSearchParams.append("accountId", "account-2");
    initialSearchParams.append("categoryId", "category-1");
    initialSearchParams.set("amountFrom", "1 000,50");
    initialSearchParams.set("description", "  аренда ");
    initialSearchParams.set("dateFrom", "2026-04-01");

    const parsed = parseTransactionFilters(initialSearchParams);

    expect(parsed).toEqual({
      amountFrom: "1000.50",
      amountTo: undefined,
      userIds: ["user-1", "user-2"],
      transactionTypes: ["expense", "income"],
      categoryIds: ["category-1"],
      accountIds: ["account-2"],
      description: "аренда",
      dateFrom: "2026-04-01",
      dateTo: undefined,
    });

    const nextSearchParams = applyTransactionFiltersToSearchParams(new URLSearchParams("workspaceId=ws-1"), parsed);

    expect(nextSearchParams.get("workspaceId")).toBe("ws-1");
    expect(parseTransactionFilters(nextSearchParams)).toEqual(normalizeTransactionFilters(parsed));
    expect(countActiveTransactionFilterGroups(parsed)).toBe(7);
  });
});
