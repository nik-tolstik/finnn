import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  type CreatePaymentTransactionInput,
  createPaymentTransactionSchema,
} from "@/shared/lib/validations/transaction";

import { PaymentTransactionType } from "../transaction.constants";

interface UseTransactionFormProps {
  defaultAccountId?: string;
}

export function useTransactionForm({ defaultAccountId }: UseTransactionFormProps) {
  return useForm<CreatePaymentTransactionInput>({
    resolver: zodResolver(createPaymentTransactionSchema),
    defaultValues: {
      accountId: defaultAccountId || "",
      amount: "",
      type: PaymentTransactionType.EXPENSE,
      description: "",
      date: new Date(),
      categoryId: undefined,
    },
  });
}
