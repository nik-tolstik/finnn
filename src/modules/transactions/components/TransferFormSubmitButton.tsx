"use client";

import type { UseFormReturn } from "react-hook-form";

import type { CreateTransferInput, UpdateTransferInput } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";


type TransferFormData = CreateTransferInput | UpdateTransferInput;

interface TransferFormSubmitButtonProps {
  form: UseFormReturn<TransferFormData>;
  onSubmit: (data: TransferFormData) => Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
}

export function TransferFormSubmitButton({
  form,
  onSubmit,
  submitLabel = "Создать перевод",
  submittingLabel = "Создание...",
}: TransferFormSubmitButtonProps) {
  return (
    <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
      {form.formState.isSubmitting ? submittingLabel : submitLabel}
    </Button>
  );
}
