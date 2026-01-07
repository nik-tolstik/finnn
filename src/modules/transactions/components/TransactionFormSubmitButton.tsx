"use client";

import type { UseFormReturn } from "react-hook-form";

import type { CreateTransactionInput } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";

import { TransactionType } from "../transaction.constants";

interface TransactionFormSubmitButtonProps {
  form: UseFormReturn<CreateTransactionInput>;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
}

export function TransactionFormSubmitButton({
  form,
  type,
  onSubmit,
}: TransactionFormSubmitButtonProps) {
  const submitLabel =
    type === TransactionType.EXPENSE ? "Создать расход" : "Создать доход";
  const submittingLabel = "Создание...";

  return (
    <Button
      type="button"
      onClick={form.handleSubmit(onSubmit)}
      disabled={form.formState.isSubmitting}
    >
      {form.formState.isSubmitting ? submittingLabel : submitLabel}
    </Button>
  );
}

