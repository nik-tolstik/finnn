import { describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_DEFAULT_DAY_COUNT,
  resolveAnalyticsDateRange,
  resolvePreviousAnalyticsDateRange,
} from "./analytics.utils";

describe("analytics.utils", () => {
  it("uses the last 30 days when no explicit date filters are provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00.000Z"));

    const range = resolveAnalyticsDateRange({});

    expect(range.startDate).toBe("2026-03-07");
    expect(range.endDate).toBe("2026-04-05");
    expect(range.dayCount).toBe(ANALYTICS_DEFAULT_DAY_COUNT);
    expect(range.isImplicit).toBe(true);
  });

  it("prefers explicit date boundaries over the implicit range", () => {
    const range = resolveAnalyticsDateRange({
      dateFrom: "2026-02-10",
      dateTo: "2026-02-20",
    });

    expect(range.startDate).toBe("2026-02-10");
    expect(range.endDate).toBe("2026-02-20");
    expect(range.dayCount).toBe(11);
    expect(range.isImplicit).toBe(false);
  });

  it("calculates the previous period with the same inclusive day count", () => {
    const currentRange = resolveAnalyticsDateRange({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-05",
    });

    const previousRange = resolvePreviousAnalyticsDateRange(currentRange);

    expect(previousRange.startDate).toBe("2026-03-27");
    expect(previousRange.endDate).toBe("2026-03-31");
    expect(previousRange.dayCount).toBe(5);
  });
});
