"use client";

import { useCallback, useEffect, useState } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

import { getExchangeRate } from "@/shared/api/generated/currency/currency";
import type { GetExchangeRateFromCurrency, GetExchangeRateToCurrency } from "@/shared/api/generated/model";
import type { Currency } from "@/shared/constants/currency";
import { divideMoney, multiplyMoney } from "@/shared/utils/money";

type EditedInput = "amount" | "toAmount" | "both" | null;

interface UseCurrencyAmountSyncProps<TFormData extends FieldValues> {
  form: UseFormReturn<TFormData>;
  fromCurrency: Currency | string | undefined;
  toCurrency: Currency | string | undefined;
  date: Date;
  amountField?: Path<TFormData>;
  toAmountField?: Path<TFormData>;
}

interface UseCurrencyAmountSyncResult {
  handleAmountChange: (value: string) => void;
  handleToAmountChange: (value: string) => void;
  exchangeRate: number | null;
  isLoadingRate: boolean;
}

export function useCurrencyAmountSync<TFormData extends FieldValues>({
  form,
  fromCurrency,
  toCurrency,
  date,
  amountField,
  toAmountField,
}: UseCurrencyAmountSyncProps<TFormData>): UseCurrencyAmountSyncResult {
  const [lastEditedInput, setLastEditedInput] = useState<EditedInput>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  const amountPath = amountField ?? ("amount" as Path<TFormData>);
  const toAmountPath = toAmountField ?? ("toAmount" as Path<TFormData>);

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
        const result = await getExchangeRate({
          date: date.toISOString(),
          fromCurrency: fromCurrency as GetExchangeRateFromCurrency,
          toCurrency: toCurrency as GetExchangeRateToCurrency,
        });
        if (!isCurrent) return;

        setExchangeRate(result.data);
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

  const setStringValue = useCallback(
    (field: Path<TFormData>, value: string) => {
      form.setValue(field, value as PathValue<TFormData, Path<TFormData>>, { shouldValidate: true });
    },
    [form]
  );

  const syncToAmount = useCallback(
    (value: string) => {
      if (!value || exchangeRate === null) {
        return;
      }

      const converted = multiplyMoney(value, exchangeRate.toString());
      const rounded = parseFloat(converted).toFixed(2);
      if (form.getValues(toAmountPath) === rounded) {
        return;
      }

      setStringValue(toAmountPath, rounded);
    },
    [exchangeRate, form, setStringValue, toAmountPath]
  );

  const syncAmount = useCallback(
    (value: string) => {
      if (!value || exchangeRate === null) {
        return;
      }

      const converted = divideMoney(value, exchangeRate.toString());
      const rounded = parseFloat(converted).toFixed(2);
      if (form.getValues(amountPath) === rounded) {
        return;
      }

      setStringValue(amountPath, rounded);
    },
    [amountPath, exchangeRate, form, setStringValue]
  );

  useEffect(() => {
    const amount = String(form.getValues(amountPath) || "");
    const toAmount = String(form.getValues(toAmountPath) || "");

    if (lastEditedInput === "amount") {
      syncToAmount(amount);
    } else if (lastEditedInput === "toAmount") {
      syncAmount(toAmount);
    } else if (amount && !toAmount) {
      syncToAmount(amount);
    }
  }, [amountPath, form, lastEditedInput, syncAmount, syncToAmount, toAmountPath]);

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
