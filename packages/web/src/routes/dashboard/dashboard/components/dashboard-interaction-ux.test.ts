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
});
