"use client";

import { useFormContext } from "react-hook-form";

import type { UpdateDebtTransactionInput } from "@/shared/lib/validations/debt";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { getCurrencySymbol } from "@/shared/utils/money";

import { DebtTransactionType } from "../../../debt.constants";
import type { DebtTransactionWithRelations } from "../../../debt.types";
import type { EditDebtTransactionDialogAccount } from "../edit-debt-transaction-dialog.types";

interface EditDebtTransactionAmountFieldsProps {
  debtTransaction: DebtTransactionWithRelations;
  selectedAccount?: EditDebtTransactionDialogAccount;
  currenciesMatch: boolean;
  debtAmountLabel: string;
  onAmountChange: (value: string) => void;
  onToAmountChange: (value: string) => void;
}

export function EditDebtTransactionAmountFields({
  debtTransaction,
  selectedAccount,
  currenciesMatch,
  debtAmountLabel,
  onAmountChange,
  onToAmountChange,
}: EditDebtTransactionAmountFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<UpdateDebtTransactionInput>();

  const showToAmountField = !currenciesMatch && Boolean(selectedAccount);
  const accountAmountLabel =
    debtTransaction.type === DebtTransactionType.CLOSED
      ? debtTransaction.debt.type === "lent"
        ? "Сумма зачисления"
        : "Сумма списания"
      : debtTransaction.debt.type === "lent"
        ? "Сумма списания"
        : "Сумма зачисления";

  return (
    <>
      {showToAmountField ? (
        <div className="space-y-2">
          <Label htmlFor="toAmount" required>
            {accountAmountLabel} ({selectedAccount?.currency})
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm font-medium text-muted-foreground">
              {selectedAccount ? getCurrencySymbol(selectedAccount.currency) : ""}
            </span>
            <NumberInput
              id="toAmount"
              placeholder="0.00"
              className="pl-9"
              {...register("toAmount", {
                onChange: (event) => onToAmountChange(event.target.value),
              })}
            />
          </div>
          {errors.toAmount ? <p className="text-sm text-destructive">{errors.toAmount.message}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="amount" required>
          {debtAmountLabel}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm font-medium text-muted-foreground">
            {getCurrencySymbol(debtTransaction.debt.currency)}
          </span>
          <NumberInput
            id="amount"
            placeholder="0.00"
            className="pl-9"
            {...register("amount", {
              onChange: (event) => onAmountChange(event.target.value),
            })}
          />
        </div>
        {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
      </div>
    </>
  );
}
