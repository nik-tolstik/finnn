import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("debt dialog entry points", () => {
  it("opens DebtDialog directly from active and closed debt lists", () => {
    const activeList = readSource("src/modules/debts/components/debts-list/DebtsList.tsx");
    const closedHistory = readSource(
      "src/modules/debts/components/closed-debts-history-dialog/ClosedDebtsHistoryDialog.tsx"
    );

    for (const source of [activeList, closedHistory]) {
      expect(source).toContain("DebtDialog");
      expect(source).toContain("debtDialog.openDialog(debt)");
      expect(source).not.toContain("DebtActionsDialog");
      expect(source).not.toContain("setTimeout");
    }
  });

  it("removes the obsolete action-picker module", () => {
    expect(
      existsSync(join(process.cwd(), "src/modules/debts/components/debt-actions-dialog/DebtActionsDialog.tsx"))
    ).toBe(false);
  });

  it("only mounts operation panels when the debt supports operations", () => {
    const source = readSource("src/modules/debts/components/debt-dialog/DebtDialog.tsx");

    expect(source).toContain("function DebtDialogOperations");
    expect(source).toMatch(/\{capabilities\.hasOperations \? \(\s*<DebtDialogOperations/);
  });
});
