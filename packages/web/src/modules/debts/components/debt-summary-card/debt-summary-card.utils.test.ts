import { describe, expect, it } from "vitest";

import { getDebtSummaryProgress } from "./debt-summary-card.utils";

describe("debt summary card progress", () => {
  it("combines settled and pending repayment progress while previewing the new remainder", () => {
    expect(
      getDebtSummaryProgress({
        totalAmount: "100",
        remainingAmount: "75",
        pendingPaymentAmount: "20",
      })
    ).toEqual({
      alreadyRepaidAmount: "25",
      debtProgressPercent: 25,
      pendingPaymentPercent: 20,
      pendingPaymentSegmentPercent: 20,
      previewRemainingAmount: "55",
      totalProgressPercent: 45,
    });
  });

  it("caps pending progress at the unsettled portion and never previews a negative remainder", () => {
    expect(
      getDebtSummaryProgress({
        totalAmount: "100",
        remainingAmount: "20",
        pendingPaymentAmount: "50",
      })
    ).toMatchObject({
      alreadyRepaidAmount: "80",
      debtProgressPercent: 80,
      pendingPaymentPercent: 50,
      pendingPaymentSegmentPercent: 20,
      previewRemainingAmount: "0",
      totalProgressPercent: 100,
    });
  });

  it("keeps authoritative values when there is no valid pending repayment", () => {
    expect(
      getDebtSummaryProgress({
        totalAmount: "100",
        remainingAmount: "75",
        pendingPaymentAmount: "",
      })
    ).toMatchObject({
      debtProgressPercent: 25,
      pendingPaymentPercent: 0,
      pendingPaymentSegmentPercent: 0,
      previewRemainingAmount: "75",
      totalProgressPercent: 25,
    });
  });
});
