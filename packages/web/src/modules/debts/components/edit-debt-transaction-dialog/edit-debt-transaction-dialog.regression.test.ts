import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("edit debt transaction dialog", () => {
  it("uses the shared debt summary card for every editable debt operation", () => {
    const source = readSource(
      "src/modules/debts/components/edit-debt-transaction-dialog/edit-debt-transaction-dialog/EditDebtTransactionDialog.tsx"
    );

    expect(source).toContain("DebtSummaryCard");
    expect(source).toContain("debtSummaryPreview");
    expect(source).not.toContain("EditDebtTransactionSummary");
  });
});
