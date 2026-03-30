"use client";

import type { Currency } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  resetSync: () => void;
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
  const prevCurrenciesRef = useRef<{ from: Currency | undefined; to: Currency | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    const loadExchangeRate = async () => {
      if (!fromCurrency || !toCurrency) {
        setExchangeRate(null);
        return;
      }

      if (fromCurrency === toCurrency) {
        setExchangeRate(1);
        return;
      }

      setIsLoadingRate(true);
      try {
        const result = await getExchangeRate(date, fromCurrency, toCurrency);
        if ("data" in result) {
          setExchangeRate(result.data);
        } else {
          console.error("Failed to get exchange rate:", result.error);
          setExchangeRate(null);
        }
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        setExchangeRate(null);
      } finally {
        setIsLoadingRate(false);
      }
    };

    loadExchangeRate();
  }, [fromCurrency, toCurrency, date]);

  useEffect(() => {
    const prevFrom = prevCurrenciesRef.current.from;
    const prevTo = prevCurrenciesRef.current.to;

    if (prevFrom !== fromCurrency || prevTo !== toCurrency) {
      prevCurrenciesRef.current = { from: fromCurrency, to: toCurrency };

      if (prevFrom !== undefined || prevTo !== undefined) {
        setLastEditedInput(null);

        if (lastEditedInput === "amount" && exchangeRate !== null) {
          const amount = form.getValues("amount");
          if (amount) {
            const converted = multiplyMoney(amount, exchangeRate.toString());
            const rounded = parseFloat(converted).toFixed(2);
            form.setValue("toAmount", rounded, { shouldValidate: true });
          }
        } else if (lastEditedInput === "toAmount" && exchangeRate !== null) {
          const toAmount = form.getValues("toAmount");
          if (toAmount) {
            const converted = divideMoney(toAmount, exchangeRate.toString());
            const rounded = parseFloat(converted).toFixed(2);
            form.setValue("amount", rounded, { shouldValidate: true });
          }
        }
      }
    }
  }, [fromCurrency, toCurrency, exchangeRate, form, lastEditedInput]);

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

      if (!value || !exchangeRate) {
        return;
      }

      const converted = multiplyMoney(value, exchangeRate.toString());
      const rounded = parseFloat(converted).toFixed(2);
      form.setValue("toAmount", rounded, { shouldValidate: true });
    },
    [lastEditedInput, exchangeRate, form]
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

      if (!value || !exchangeRate) {
        return;
      }

      const converted = divideMoney(value, exchangeRate.toString());
      const rounded = parseFloat(converted).toFixed(2);
      form.setValue("amount", rounded, { shouldValidate: true });
    },
    [lastEditedInput, exchangeRate, form]
  );

  const resetSync = useCallback(() => {
    setLastEditedInput(null);
  }, []);

  return {
    handleAmountChange,
    handleToAmountChange,
    resetSync,
    exchangeRate,
    isLoadingRate,
  };
}
