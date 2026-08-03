import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("dashboard interaction loading", () => {
  it("keeps first-level dashboard dialogs in the interactive route chunk", () => {
    const dashboardSource = readSource("src/routes/dashboard/dashboard/components/DashboardContent.tsx");
    const accountsSource = readSource("src/modules/accounts/components/accounts-cards/AccountsCards.tsx");
    const transactionsSource = readSource(
      "src/modules/transactions/components/combined-transactions-list/CombinedTransactionsList.tsx"
    );

    expect(dashboardSource).toContain(
      'import { CreateAccountDialog } from "@/modules/accounts/components/create-account-dialog/CreateAccountDialog"'
    );
    expect(dashboardSource).toContain(
      'import { TransactionsFilterDrawer } from "@/modules/transactions/components/transactions-filters/components/TransactionsFilterDrawer"'
    );
    expect(accountsSource).toContain(
      'import { AccountActionsDialog } from "@/modules/accounts/components/account-actions-dialog/AccountActionsDialog"'
    );
    expect(transactionsSource).toContain(
      'import { CombinedTransactionsDialogs } from "./components/CombinedTransactionsDialogs"'
    );
  });

  it("does not cover the dashboard with a loading interstitial after a user action", () => {
    const sources = [
      readSource("src/routes/dashboard/dashboard/components/DashboardContent.tsx"),
      readSource("src/modules/accounts/components/accounts-cards/AccountsCards.tsx"),
      readSource("src/modules/transactions/components/combined-transactions-list/CombinedTransactionsList.tsx"),
    ];

    for (const source of sources) {
      expect(source).not.toContain("DialogLoadingFallback");
      expect(source).not.toContain("Загрузка…");
    }
  });

  it("opens transaction editors directly and keeps their actions in the shared options menu", () => {
    const transactionsSource = readSource(
      "src/modules/transactions/components/combined-transactions-list/CombinedTransactionsList.tsx"
    );
    const dialogsSource = readSource(
      "src/modules/transactions/components/combined-transactions-list/components/CombinedTransactionsDialogs.tsx"
    );
    const controllerSource = readSource(
      "src/modules/transactions/components/combined-transactions-list/hooks/useCombinedTransactionsController.ts"
    );
    const editTransactionSource = readSource(
      "src/modules/transactions/components/edit-transaction-dialog/EditTransactionDialog.tsx"
    );
    const dialogSource = readSource("src/shared/ui/dialog/Dialog.tsx");

    expect(transactionsSource).toContain("onTransactionClick={controller.openTransactionDialog}");
    expect(transactionsSource).toContain("onDebtTransactionClick={controller.openDebtTransactionDialog}");
    expect(controllerSource).toContain("const openTransactionDialog");
    expect(controllerSource).toContain("const openDebtTransactionDialog");
    expect(dialogsSource).not.toContain("TransactionActionsDialog");
    expect(dialogsSource).not.toContain("DebtTransactionActionsDialog");
    expect(editTransactionSource).toContain('label: "Повторить"');
    expect(editTransactionSource).toContain('label: "Удалить"');
    expect(dialogSource).toContain("function DialogCloseButton");
    expect(dialogSource).toContain("export interface DialogAction");
    expect(dialogSource).toContain("actions?: DialogAction[]");
    expect(dialogSource).toContain("closeButtonDisabled?: boolean");
    expect(dialogSource).toContain("<DialogCloseButton");
    expect(dialogSource).toContain("function DialogOptionsButton");
    expect(dialogSource).toContain("function DialogFooter");
    expect(dialogSource).toContain("<Popover");
    expect(dialogSource).toContain("<Sheet");
    expect(dialogSource).toContain('aria-label="Действия"');
    expect(dialogSource).toContain("max-h-[calc(100dvh-4rem)]");
    expect(dialogSource).toContain('transform: "translateY(100%)"');
    expect(dialogSource).toContain("outsidePress: !nestedOverlayOpen");
    expect(dialogSource).toContain("showCloseButton && !isMobile");
    expect(dialogSource).toContain("hasActions && !isMobile");
    expect(dialogSource).toContain("[&>button]:flex-1");
    expect(dialogSource).toContain("shrink-0 items-center");
    expect(dialogSource).not.toContain("mobilePosition");
    expect(editTransactionSource).toContain("actions=");
  });

  it("moves transaction and debt dialog actions into the shared options menu", () => {
    const headerDialogSources = [
      "src/modules/transactions/components/edit-transaction-dialog/EditTransactionDialog.tsx",
      "src/modules/transactions/components/edit-transfer-dialog/EditTransferDialog.tsx",
      "src/modules/debts/components/debt-write-off-dialog/DebtWriteOffDialog.tsx",
      "src/modules/debts/components/edit-debt-dialog/EditDebtDialog.tsx",
      "src/modules/debts/components/edit-debt-transaction-dialog/edit-debt-transaction-dialog/EditDebtTransactionDialog.tsx",
      "src/modules/debts/components/debt-dialog/DebtDialog.tsx",
    ].map(readSource);

    for (const source of headerDialogSources) {
      expect(source).toContain("actions=");
      expect(source).not.toContain('label: "Удалить ');
      expect(source).not.toContain('import { Tooltip } from "@/shared/ui/tooltip"');
      expect(source).not.toContain("<DialogCloseButton");
      expect(source).not.toContain("headerActions=");
    }
  });

  it("keeps the category editor instant and preloads its data", () => {
    const categoryDialogSource = readSource(
      "src/modules/accounts/components/category-settings-dialog/CategorySettingsDialog.tsx"
    );
    const categoryPreloadSource = readSource(
      "src/modules/accounts/components/category-settings-dialog/useCategorySettingsPreload.ts"
    );

    expect(categoryDialogSource).toContain("<DialogTitle>Настройки категорий</DialogTitle>");
    expect(categoryDialogSource).toContain(
      'import { CategoryManagement } from "../category-management/CategoryManagement"'
    );
    expect(categoryDialogSource).not.toContain("lazy(");
    expect(categoryPreloadSource).toContain("requestIdleCallback");
    expect(categoryPreloadSource).toContain(".prefetchQuery({");
  });
});
