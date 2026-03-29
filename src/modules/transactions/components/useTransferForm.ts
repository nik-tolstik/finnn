import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { type CreateTransferInput, createTransferSchema } from "@/shared/lib/validations/transaction";

interface UseTransferFormProps {
  defaultAccountId?: string;
}

export function useTransferForm({ defaultAccountId }: UseTransferFormProps) {
  return useForm<CreateTransferInput>({
    resolver: zodResolver(createTransferSchema),
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
