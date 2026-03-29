"use client";

import { useFormContext } from "react-hook-form";

import type { UpdateDebtTransactionInput } from "@/shared/lib/validations/debt";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { getCurrencySymbol } from "@/shared/utils/money";

import { DebtTransactionType } from "../../debt.constants";
import type { DebtTransactionWithRelations } from "../../debt.types";
import type { EditDebtTransactionDialogAccount } from "./edit-debt-transaction-dialog.types";

interface EditDebtTransactionAmountFieldsProps {
  debtTransaction: DebtTransactionWithRelations;
  selectedAccount?: EditDebtTransactionDialogAccount;
  currenciesMatch: boolean;
  debtAmountLabel: string;
}

export function EditDebtTransactionAmountFields({
  debtTransaction,
  selectedAccount,
  currenciesMatch,
  debtAmountLabel,
}: EditDebtTransactionAmountFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<UpdateDebtTransactionInput>();

  const showToAmountField =
    debtTransaction.type === DebtTransactionType.CLOSED && !currenciesMatch && Boolean(selectedAccount);

  return (
    <>
      {showToAmountField ? (
        <div className="space-y-2">
          <Label htmlFor="toAmount">
            Сумма отправления ({selectedAccount?.currency}) <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm font-medium text-muted-foreground">
              {selectedAccount ? getCurrencySymbol(selectedAccount.currency) : ""}
            </span>
            <NumberInput id="toAmount" placeholder="0.00" className="pl-9" {...register("toAmount")} />
          </div>
          {errors.toAmount ? <p className="text-sm text-destructive">{errors.toAmount.message}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="amount">
          {debtAmountLabel} <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm font-medium text-muted-foreground">
            {getCurrencySymbol(debtTransaction.debt.currency)}
          </span>
          <NumberInput id="amount" placeholder="0.00" className="pl-9" {...register("amount")} />
        </div>
        {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
      </div>
    </>
  );
}
