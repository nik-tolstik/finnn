"use client";

import { FormProvider } from "react-hook-form";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";

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
  } = useEditDebtTransactionDialog({
    debtTransaction,
    workspaceId,
    open,
    onOpenChange,
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
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
              />
              <EditDebtTransactionDateField />
            </form>
          </FormProvider>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form={EDIT_DEBT_TRANSACTION_FORM_ID} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
