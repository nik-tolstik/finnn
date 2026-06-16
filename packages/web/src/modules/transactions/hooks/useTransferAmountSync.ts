"use client";

import type { UseFormReturn } from "react-hook-form";

import type { Currency } from "@/shared/constants/currency";
import { useCurrencyAmountSync } from "@/shared/hooks/useCurrencyAmountSync";
import type {
  CreateTransferTransactionInput,
  UpdateTransferTransactionInput,
} from "@/shared/lib/validations/transaction";

type TransferFormData = CreateTransferTransactionInput | UpdateTransferTransactionInput;

interface UseTransferAmountSyncProps {
  form: UseFormReturn<TransferFormData>;
  fromCurrency: Currency | undefined;
  toCurrency: Currency | undefined;
  date: Date;
}

export function useTransferAmountSync({ form, fromCurrency, toCurrency, date }: UseTransferAmountSyncProps) {
  return useCurrencyAmountSync({
    form,
    fromCurrency,
    toCurrency,
    date,
  });
}
