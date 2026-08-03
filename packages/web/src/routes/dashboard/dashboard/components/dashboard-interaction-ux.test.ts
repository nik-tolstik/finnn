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

  it("opens transaction editors directly and keeps their actions in the editor header", () => {
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

    expect(transactionsSource).toContain("onTransactionClick={controller.openTransactionDialog}");
    expect(transactionsSource).toContain("onDebtTransactionClick={controller.openDebtTransactionDialog}");
    expect(controllerSource).toContain("const openTransactionDialog");
    expect(controllerSource).toContain("const openDebtTransactionDialog");
    expect(dialogsSource).not.toContain("TransactionActionsDialog");
    expect(dialogsSource).not.toContain("DebtTransactionActionsDialog");
    expect(editTransactionSource).toContain("showCloseButton={false}");
    expect(editTransactionSource).toContain('aria-label="Повторить транзакцию"');
    expect(editTransactionSource).toContain('aria-label="Удалить транзакцию"');
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
