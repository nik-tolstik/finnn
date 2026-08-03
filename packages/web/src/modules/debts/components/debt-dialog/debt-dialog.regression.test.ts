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

  it("moves focus to the title when the dialog opens or changes view", () => {
    const source = readSource("src/modules/debts/components/debt-dialog/DebtDialog.tsx");
    const dialogSource = readSource("src/shared/ui/dialog/Dialog.tsx");

    expect(source).toContain("const titleRef = useRef<HTMLHeadingElement>(null)");
    expect(source).toContain("const titleFocusKeyRef = useRef<string | null>(null)");
    expect(source).toMatch(/const focusKey = open \? `\$\{debt\.id\}:\$\{view\}` : null/);
    expect(source).toContain("titleRef.current?.focus()");
    expect(source).toContain("tabIndex={-1}");
    expect(dialogSource).toContain("React.forwardRef<HTMLHeadingElement");
  });

  it("reuses the debt summary card and keeps the mobile dialog compact", () => {
    const writeOffPanel = readSource("src/modules/debts/components/debt-write-off-dialog/DebtWriteOffDialog.tsx");
    const closePanel = readSource("src/modules/debts/components/close-debt-dialog/CloseDebtDialog.tsx");
    const addPanel = readSource("src/modules/debts/components/add-to-debt-dialog/AddToDebtDialog.tsx");
    const dialogSource = readSource("src/modules/debts/components/debt-dialog/DebtDialog.tsx");

    for (const source of [writeOffPanel, closePanel, addPanel]) {
      expect(source).toContain("DebtSummaryCard");
    }

    expect(dialogSource).toContain('mobilePosition="bottom"');
    expect(dialogSource).toContain("max-sm:max-h-[calc(100dvh-1rem)]");
    expect(dialogSource).toContain('className="flex-none shrink-0 pb-0"');
  });
});
