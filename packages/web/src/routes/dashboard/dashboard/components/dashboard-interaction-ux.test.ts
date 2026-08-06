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
    expect(dashboardSource).toContain("const CreateTransactionDialog = lazy(loadCreateTransactionDialog)");
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
    expect(dialogSource).toContain("onClick={() => setOpen((current) => !current)}");
    expect(dialogSource).not.toContain('import { Tooltip } from "@/shared/ui/tooltip"');
    expect(dialogSource).not.toContain("<Tooltip");
    expect(dialogSource).toContain("function DialogFooter");
    expect(dialogSource).not.toContain("function ActionsDialog");
    expect(actionsDialogSource).toContain("<Popover");
    expect(actionsDialogSource).toContain("<Sheet");
    expect(actionsDialogSource).toContain("reference={anchor}");
    expect(actionsDialogSource).toContain("onOpenChange(false);\n    action.onSelect();");
    expect(actionsDialogSource).toContain("max-h-[calc(100dvh-4rem)]");
    expect(actionsDialogSource).toContain('size={isMobile ? "touch" : "compact"}');
    expect(actionsDialogSource).toContain("min-h-12");
    expect(actionsDialogSource).toContain('"min-h-12 gap-3 px-3 py-2.5 text-sm font-normal"');
    expect(popoverSource).toContain("reference: ReferenceType | null");
    expect(popoverSource).toContain("trigger?:");
    expect(sheetSource).toContain("onCloseComplete?: () => void");
    expect(sheetSource).toContain('side === "bottom" ? "scale(0.96)" : getClosedTransform(side)');
    expect(dialogSource).toContain('aria-label="Действия"');
    expect(dialogSource).toContain("max-h-[calc(100dvh-4rem)]");
    expect(dialogSource).toContain('transform: "scale(0.96)"');
    expect(dialogSource).not.toContain('transform: "translateY(100%)"');
    expect(dialogSource).toContain("escapeKey: dismissOnEscapeKey && !nestedOverlayOpen");
    expect(dialogSource).toContain("outsidePress: dismissOnOutsidePress && !nestedOverlayOpen");
    expect(dialogSource).toContain("{showCloseButton ? (");
    expect(dialogSource).toContain(
      'className={isMobile ? "inline-flex size-8 items-center justify-center p-0" : undefined}'
    );
    expect(dialogSource).toContain('"flex flex-col gap-2 px-6 text-left"');
    expect(dialogSource).toContain('hasActions && "flex-row items-center [&>button]:flex-1"');
    expect(dialogSource).toContain("{hasActions ? (");
    expect(dialogSource).not.toContain("hasActions && isMobile ? <DialogOptionsButton");
    expect(dialogSource).not.toContain("hasActions && !isMobile");
    expect(dialogSource).toContain("[&>button]:flex-1");
    expect(dialogSource).toContain("shrink-0 items-center");
    expect(dialogSource).not.toContain("mobilePosition");
    expect(editTransactionSource).toContain("actions=");
  });

  it("opens account action menus from a normal card click", () => {
    const accountCardSource = readSource("src/shared/components/account-card/AccountCard.tsx");
    const accountsCardsSource = readSource("src/modules/accounts/components/accounts-cards/AccountsCards.tsx");
    const accountActionsSource = readSource(
      "src/modules/accounts/components/account-actions-dialog/AccountActionsDialog.tsx"
    );
    const actionsDialogSource = readSource("src/shared/ui/actions-dialog/ActionsDialog.tsx");

    expect(accountCardSource).toContain("MouseEventHandler<HTMLButtonElement>");
    expect(accountsCardsSource).toContain("accountActionsDialog.openDialog({ account, anchor: event.currentTarget })");
    expect(accountsCardsSource).toContain("onClick={(event) => {");
    expect(accountsCardsSource).toContain(
      "const accountActionAfterCloseRef = useRef<AccountActionAfterClose | null>(null)"
    );
    expect(accountsCardsSource).toContain("onCloseComplete={handleAccountActionsCloseComplete}");
    expect(accountsCardsSource).toContain('queueAccountActionAfterClose({ type: "edit"');
    expect(accountsCardsSource).toContain('queueAccountActionAfterClose({ type: "archive"');
    expect(accountsCardsSource).toContain('queueAccountActionAfterClose({ type: "create-transaction"');
    expect(accountsCardsSource).toContain("accountActionAfterCloseRef.current = null;");
    expect(accountsCardsSource).not.toContain("useBreakpoints");
    expect(accountActionsSource).toContain('label: "Транзакция"');
    expect(accountActionsSource).toContain('label: "Изменить"');
    expect(accountActionsSource).toContain(
      'import { AccountCard } from "@/shared/components/account-card/AccountCard"'
    );
    expect(accountActionsSource).toContain("<AccountCard account={account} showOwner={false} />");
    expect(accountActionsSource).toContain('mobileActionsClassName="gap-2"');
    expect(accountActionsSource).toContain('mobileContentClassName="px-6 pt-3 pb-6"');
    expect(accountActionsSource).toContain('tone: "destructive"');
    expect(accountActionsSource).toContain("anchor={anchor}");
    expect(accountActionsSource).toContain("open={open}");
    expect(accountActionsSource).not.toContain("trigger={trigger}");
    expect(actionsDialogSource).toContain("if (isMobile)");
    expect(actionsDialogSource).toContain("<Sheet");
    expect(actionsDialogSource).toContain("mobileContext");
    expect(actionsDialogSource).toContain("mobileActionsClassName");
    expect(actionsDialogSource).toContain("mobileContentClassName");
    expect(actionsDialogSource).toContain("<SheetTitle>Действия</SheetTitle>");
    expect(actionsDialogSource).toContain('"min-h-12 gap-3 px-3 py-2.5 text-sm font-normal"');
    expect(actionsDialogSource).not.toContain("emphasis");
    expect(actionsDialogSource).not.toContain("separate");
    expect(actionsDialogSource).not.toContain("bg-primary/10 hover:bg-primary/20");
  });

  it("keeps scheduled payment action menus anchored without changing their entry point", () => {
    const scheduledPaymentListSource = readSource("src/modules/scheduled-payments/components/ScheduledPaymentList.tsx");
    const scheduledPaymentActionsSource = readSource(
      "src/modules/scheduled-payments/components/ScheduledPaymentActionsDialog.tsx"
    );
    const paymentsContentSource = readSource("src/routes/dashboard/payments/components/PaymentsContent.tsx");

    expect(scheduledPaymentListSource).toContain("onPaymentClick(payment, event.currentTarget)");
    expect(scheduledPaymentListSource).toContain("md:hidden");
    expect(paymentsContentSource).toContain("actionsDialog.openDialog({ anchor, payment })");
    expect(scheduledPaymentActionsSource).toContain("anchor={anchor}");
    expect(scheduledPaymentActionsSource).toContain('tone: "destructive"');
  });

  it("keeps the dashboard transaction section focused on history and filters", () => {
    const dashboardSource = readSource("src/routes/dashboard/dashboard/components/DashboardContent.tsx");

    expect(dashboardSource).toContain(
      'import("@/modules/transactions/components/create-transaction-dialog/CreateTransactionDialog")'
    );
    expect(dashboardSource).toContain('<h2 className="text-xl font-semibold">История</h2>');
    expect(dashboardSource).toContain("<TransactionsFilterButton");
    expect(dashboardSource).not.toContain("createTransactionDialog.openDialog(null)");
    expect(dashboardSource).toContain("<CreateTransactionDialog");
  });

  it("shows the visible-account balance and ordered quick actions", () => {
    const dashboardSource = readSource("src/routes/dashboard/dashboard/components/DashboardContent.tsx");
    const summarySource = readSource(
      "src/modules/accounts/components/account-balance-summary/AccountBalanceSummary.tsx"
    );

    expect(dashboardSource).toContain("toDashboardBalanceSummary");
    expect(dashboardSource).toContain("dashboardBalanceAccountIds");
    expect(dashboardSource).toContain("<AccountBalanceSummary");
    expect(dashboardSource).toContain('label: "Расход"');
    expect(dashboardSource).toContain('label: "Доход"');
    expect(dashboardSource).toContain('label: "Перевод"');
    expect(dashboardSource).toContain('label: "Долг"');
    expect(summarySource).toContain("actions.map");
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
