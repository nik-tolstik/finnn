"use client";

import type { Currency } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { getExchangeRate } from "@/modules/currency/exchange-rate.service";
import type {
  CreateTransferTransactionInput,
  UpdateTransferTransactionInput,
} from "@/shared/lib/validations/transaction";
import { divideMoney, multiplyMoney } from "@/shared/utils/money";

type TransferFormData = CreateTransferTransactionInput | UpdateTransferTransactionInput;
type EditedInput = "amount" | "toAmount" | "both" | null;

interface UseTransferAmountSyncProps {
  form: UseFormReturn<TransferFormData>;
  fromCurrency: Currency | undefined;
  toCurrency: Currency | undefined;
  date: Date;
}

interface UseTransferAmountSyncResult {
  handleAmountChange: (value: string) => void;
  handleToAmountChange: (value: string) => void;
  exchangeRate: number | null;
  isLoadingRate: boolean;
}

export function useTransferAmountSync({
  form,
  fromCurrency,
  toCurrency,
  date,
}: UseTransferAmountSyncProps): UseTransferAmountSyncResult {
  const [lastEditedInput, setLastEditedInput] = useState<EditedInput>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const loadExchangeRate = async () => {
      if (!fromCurrency || !toCurrency) {
        setExchangeRate(null);
        setIsLoadingRate(false);
        return;
      }

      if (fromCurrency === toCurrency) {
        setExchangeRate(1);
        setIsLoadingRate(false);
        return;
      }

      setIsLoadingRate(true);
      try {
        const result = await getExchangeRate(date, fromCurrency, toCurrency);
        if (!isCurrent) return;

        if ("data" in result) {
          setExchangeRate(result.data);
        } else {
          console.error("Failed to get exchange rate:", result.error);
          setExchangeRate(null);
        }
      } catch (error) {
        if (!isCurrent) return;

        console.error("Error fetching exchange rate:", error);
        setExchangeRate(null);
      } finally {
        if (isCurrent) {
          setIsLoadingRate(false);
        }
      }
    };

    loadExchangeRate();

    return () => {
      isCurrent = false;
    };
  }, [fromCurrency, toCurrency, date]);

  const syncToAmount = useCallback(
    (value: string) => {
      if (!value || exchangeRate === null) {
        return;
      }

      const converted = multiplyMoney(value, exchangeRate.toString());
      const rounded = parseFloat(converted).toFixed(2);
      if (form.getValues("toAmount") === rounded) {
        return;
      }

      form.setValue("toAmount", rounded, { shouldValidate: true });
    },
    [exchangeRate, form]
  );

  const syncAmount = useCallback(
    (value: string) => {
      if (!value || exchangeRate === null) {
        return;
      }

      const converted = divideMoney(value, exchangeRate.toString());
      const rounded = parseFloat(converted).toFixed(2);
      if (form.getValues("amount") === rounded) {
        return;
      }

      form.setValue("amount", rounded, { shouldValidate: true });
    },
    [exchangeRate, form]
  );

  useEffect(() => {
    if (lastEditedInput === "amount") {
      syncToAmount(form.getValues("amount"));
    } else if (lastEditedInput === "toAmount") {
      syncAmount(form.getValues("toAmount"));
    }
  }, [form, lastEditedInput, syncAmount, syncToAmount]);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (lastEditedInput === "both") {
        return;
      }

      if (lastEditedInput === "toAmount") {
        setLastEditedInput("both");
        return;
      }

      setLastEditedInput("amount");

      syncToAmount(value);
    },
    [lastEditedInput, syncToAmount]
  );

  const handleToAmountChange = useCallback(
    (value: string) => {
      if (lastEditedInput === "both") {
        return;
      }

      if (lastEditedInput === "amount") {
        setLastEditedInput("both");
        return;
      }

      setLastEditedInput("toAmount");

      syncAmount(value);
    },
    [lastEditedInput, syncAmount]
  );

  return {
    handleAmountChange,
    handleToAmountChange,
    exchangeRate,
    isLoadingRate,
  };
}
