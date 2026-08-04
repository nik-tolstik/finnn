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

  it("keeps the closed debts history open while a debt dialog is mounted", () => {
    const closedHistory = readSource(
      "src/modules/debts/components/closed-debts-history-dialog/ClosedDebtsHistoryDialog.tsx"
    );
    const dialogSource = readSource("src/shared/ui/dialog/Dialog.tsx");

    expect(closedHistory).toContain("dismissOnEscapeKey={!debtDialog.mounted}");
    expect(closedHistory).toContain("dismissOnOutsidePress={!debtDialog.mounted}");
    expect(dialogSource).toContain("dismissOnEscapeKey?: boolean");
    expect(dialogSource).toContain("dismissOnOutsidePress?: boolean");
    expect(dialogSource).toContain("dismissOnEscapeKey = true");
    expect(dialogSource).toContain("dismissOnOutsidePress = true");
    expect(dialogSource).toContain("escapeKey: dismissOnEscapeKey && !nestedOverlayOpen");
    expect(dialogSource).toContain("outsidePress: dismissOnOutsidePress && !nestedOverlayOpen");
  });

  it("leaves space below the last closed debt card for its shadow", () => {
    const closedHistory = readSource(
      "src/modules/debts/components/closed-debts-history-dialog/ClosedDebtsHistoryDialog.tsx"
    );

    expect(closedHistory).toContain('className="min-h-0 overflow-y-auto pb-3"');
  });

  it("removes the obsolete action-picker module", () => {
    expect(
      existsSync(join(process.cwd(), "src/modules/debts/components/debt-actions-dialog/DebtActionsDialog.tsx"))
    ).toBe(false);
  });

  it("keeps adding to a debt account-backed", () => {
    const source = readSource("src/modules/debts/components/add-to-debt-dialog/AddToDebtDialog.tsx");

    expect(source.match(/useAccount: true/g)).toHaveLength(2);
    expect(source).toContain("toCurrency: selectedAccount?.currency");
    expect(source).toContain("<AccountSelector");
    expect(source.indexOf("<AccountSelector")).toBeLessThan(source.indexOf('<Label htmlFor="addAmount" required>'));
    expect(source).not.toContain("Checkbox");
    expect(source).not.toContain("Использовать счёт");
    expect(source).not.toContain("useAccount ?");
    expect(source).not.toContain("data.useAccount");
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

  it("reuses the debt summary card and delegates mobile sizing to the shared dialog", () => {
    const writeOffPanel = readSource("src/modules/debts/components/debt-write-off-dialog/DebtWriteOffDialog.tsx");
    const closePanel = readSource("src/modules/debts/components/close-debt-dialog/CloseDebtDialog.tsx");
    const addPanel = readSource("src/modules/debts/components/add-to-debt-dialog/AddToDebtDialog.tsx");
    const dialogSource = readSource("src/modules/debts/components/debt-dialog/DebtDialog.tsx");

    for (const source of [writeOffPanel, closePanel, addPanel]) {
      expect(source).toContain("DebtSummaryCard");
    }

    const sharedDialogSource = readSource("src/shared/ui/dialog/Dialog.tsx");

    expect(dialogSource).not.toContain("mobilePosition");
    expect(dialogSource).not.toContain("max-sm:max-h");
    expect(sharedDialogSource).toContain("max-h-[calc(100dvh-4rem)]");
    expect(sharedDialogSource).toContain('transform: "scale(0.96)"');
    expect(sharedDialogSource).not.toContain('transform: "translateY(100%)"');
    expect(dialogSource).toContain('className="flex-none shrink-0 pb-0"');
  });

  it("keeps the shared debt summary card compact and neutral", () => {
    const source = readSource("src/modules/debts/components/debt-summary-card/DebtSummaryCard.tsx");

    expect(source).not.toContain("UserRound");
    expect(source).not.toContain("lucide-react");
    expect(source).not.toContain("destructive");
    expect(source).not.toContain("text-success");
    expect(source).toContain('className="text-xs text-muted-foreground"');
    expect(source).toContain('className="h-full bg-foreground transition-[width]"');
    expect(source).toContain('className="h-full bg-primary transition-[width]"');
  });
});
