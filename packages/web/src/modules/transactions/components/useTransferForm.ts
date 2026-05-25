import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  type CreateTransferTransactionInput,
  createTransferTransactionSchema,
} from "@/shared/lib/validations/transaction";

interface UseTransferFormProps {
  defaultAccountId?: string;
}

export function useTransferForm({ defaultAccountId }: UseTransferFormProps) {
  return useForm<CreateTransferTransactionInput>({
    resolver: zodResolver(createTransferTransactionSchema),
    defaultValues: {
      fromAccountId: defaultAccountId || "",
      toAccountId: "",
      amount: "",
      toAmount: "",
      description: "",
      date: new Date(),
    },
  });
}
