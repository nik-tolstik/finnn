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
    const actionsDialogSource = readSource("src/shared/ui/actions-dialog/ActionsDialog.tsx");
    const popoverSource = readSource("src/shared/ui/popover/Popover.tsx");
    const sheetSource = readSource("src/shared/ui/sheet/Sheet.tsx");

    expect(transactionsSource).toContain("onTransactionClick={controller.openTransactionDialog}");
    expect(transactionsSource).toContain("onDebtTransactionClick={controller.openDebtTransactionDialog}");
    expect(controllerSource).toContain("const openTransactionDialog");
    expect(controllerSource).toContain("const openDebtTransactionDialog");
    expect(dialogsSource).not.toContain("TransactionActionsDialog");
    expect(dialogsSource).not.toContain("DebtTransactionActionsDialog");
    expect(editTransactionSource).toContain('label: "Повторить"');
    expect(editTransactionSource).toContain('label: "Удалить"');
    expect(dialogSource).toContain("function DialogCloseButton");
    expect(dialogSource).toContain("export type DialogAction = ActionItem");
    expect(dialogSource).toContain("actions?: DialogAction[]");
    expect(dialogSource).toContain("closeButtonDisabled?: boolean");
    expect(dialogSource).toContain("<DialogCloseButton");
    expect(dialogSource).toContain("function DialogOptionsButton");
    expect(dialogSource).toContain("<ActionsDialog");
    expect(dialogSource).toContain("anchor={optionsButtonRef.current}");
    expect(dialogSource).toContain("function DialogFooter");
    expect(dialogSource).not.toContain("function ActionsDialog");
    expect(actionsDialogSource).toContain("<Popover");
    expect(actionsDialogSource).toContain("<Sheet");
    expect(actionsDialogSource).toContain("reference={anchor}");
    expect(actionsDialogSource).toContain("onOpenChange(false);\n    action.onSelect();");
    expect(actionsDialogSource).toContain("max-h-[calc(100dvh-4rem)]");
    expect(popoverSource).toContain("reference: ReferenceType | null");
    expect(popoverSource).toContain("trigger?:");
    expect(sheetSource).toContain("onCloseComplete?: () => void");
    expect(sheetSource).toContain('side === "bottom" ? undefined : getClosedTransform(side)');
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

  it("anchors account and payment action menus without changing their entry points", () => {
    const accountCardSource = readSource("src/shared/components/account-card/AccountCard.tsx");
    const accountsCardsSource = readSource("src/modules/accounts/components/accounts-cards/AccountsCards.tsx");
    const accountActionsSource = readSource(
      "src/modules/accounts/components/account-actions-dialog/AccountActionsDialog.tsx"
    );
    const scheduledPaymentListSource = readSource("src/modules/scheduled-payments/components/ScheduledPaymentList.tsx");
    const scheduledPaymentActionsSource = readSource(
      "src/modules/scheduled-payments/components/ScheduledPaymentActionsDialog.tsx"
    );
    const paymentsContentSource = readSource("src/routes/dashboard/payments/components/PaymentsContent.tsx");

    expect(accountCardSource).toContain("MouseEventHandler<HTMLButtonElement>");
    expect(accountsCardsSource).toContain("anchor: event.currentTarget");
    expect(accountActionsSource).toContain("anchor={anchor}");
    expect(accountActionsSource).toContain('tone: "destructive"');
    expect(scheduledPaymentListSource).toContain("onPaymentClick(payment, event.currentTarget)");
    expect(scheduledPaymentListSource).toContain("md:hidden");
    expect(paymentsContentSource).toContain("actionsDialog.openDialog({ anchor, payment })");
    expect(scheduledPaymentActionsSource).toContain("anchor={anchor}");
    expect(scheduledPaymentActionsSource).toContain('tone: "destructive"');
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
