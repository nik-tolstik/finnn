import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  createTransactionSchema,
  type CreateTransactionInput,
} from "@/shared/lib/validations/transaction";

import { TransactionType } from "../transaction.constants";

interface UseTransactionFormProps {
  defaultAccountId?: string;
}

export function useTransactionForm({ defaultAccountId }: UseTransactionFormProps) {
  return useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      accountId: defaultAccountId || "",
      amount: "",
      type: TransactionType.EXPENSE,
      description: "",
      date: new Date(),
      categoryId: undefined,
    },
  });
}

