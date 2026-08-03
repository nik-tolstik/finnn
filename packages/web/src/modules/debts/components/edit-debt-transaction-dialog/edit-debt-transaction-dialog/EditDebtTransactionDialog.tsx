import { Trash2 } from "lucide-react";
import { FormProvider } from "react-hook-form";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { Tooltip } from "@/shared/ui/tooltip";

import { EditDebtTransactionAccountSection } from "../edit-debt-transaction-account-section/EditDebtTransactionAccountSection";
import { EditDebtTransactionAmountFields } from "../edit-debt-transaction-amount-fields/EditDebtTransactionAmountFields";
import { EditDebtTransactionDateField } from "../edit-debt-transaction-date-field/EditDebtTransactionDateField";
import type { EditDebtTransactionDialogProps } from "../edit-debt-transaction-dialog.types";
import { EditDebtTransactionSummary } from "../edit-debt-transaction-summary/EditDebtTransactionSummary";
import { useEditDebtTransactionDialog } from "../useEditDebtTransactionDialog";

const EDIT_DEBT_TRANSACTION_FORM_ID = "edit-debt-transaction-form";

export function EditDebtTransactionDialog({
  debtTransaction,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  onSuccess,
  onDelete,
}: EditDebtTransactionDialogProps) {
  const {
    form,
    handleSubmit,
    dialogTitle,
    dialogDescription,
    debtAmountLabel,
    selectedAccount,
    previewAccount,
    currenciesMatch,
    currentAccountUnavailable,
    handleAmountChange,
    handleToAmountChange,
  } = useEditDebtTransactionDialog({
    debtTransaction,
    workspaceId,
    open,
    onOpenChange,
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete} showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate">{dialogTitle}</DialogTitle>
            <div className="flex shrink-0 items-center gap-1">
              {onDelete ? (
                <Tooltip content="Удалить транзакцию долга" delayDuration={0} disableHoverableContent>
                  <Button
                    aria-label="Удалить транзакцию долга"
                    disabled={form.formState.isSubmitting}
                    onClick={onDelete}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </Tooltip>
              ) : null}
              <DialogCloseButton disabled={form.formState.isSubmitting} onClick={() => onOpenChange(false)} />
            </div>
          </div>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <FormProvider {...form}>
            <form id={EDIT_DEBT_TRANSACTION_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
              <EditDebtTransactionSummary debtTransaction={debtTransaction} />
              <EditDebtTransactionAccountSection
                debtTransaction={debtTransaction}
                workspaceId={workspaceId}
                selectedAccount={selectedAccount}
                previewAccount={previewAccount}
                currentAccountUnavailable={currentAccountUnavailable}
              />
              <EditDebtTransactionAmountFields
                debtTransaction={debtTransaction}
                selectedAccount={selectedAccount}
                currenciesMatch={currenciesMatch}
                debtAmountLabel={debtAmountLabel}
                onAmountChange={handleAmountChange}
                onToAmountChange={handleToAmountChange}
              />
              <EditDebtTransactionDateField />
            </form>
          </FormProvider>
        </DialogContent>
        <DialogFooter>
          <Button
            type="submit"
            form={EDIT_DEBT_TRANSACTION_FORM_ID}
            disabled={!form.formState.isValid || form.formState.isSubmitting}
            size="xl"
          >
            {form.formState.isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
