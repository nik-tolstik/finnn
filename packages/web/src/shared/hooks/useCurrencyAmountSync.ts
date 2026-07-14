"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

import { getExchangeRate } from "@/shared/api/generated/currency/currency";
import type { GetExchangeRateFromCurrency, GetExchangeRateToCurrency } from "@/shared/api/generated/model";
import type { Currency } from "@/shared/constants/currency";
import { exchangeRateKeys } from "@/shared/lib/query-keys";
import { getExchangeRateDateKey } from "@/shared/utils/exchange-rate-date";
import { divideMoney, multiplyMoney, roundMoney } from "@/shared/utils/money";

import { type CurrencyAmountEditedInput, getRateIdentityTransition } from "./currency-amount-sync";

interface UseCurrencyAmountSyncProps<TFormData extends FieldValues> {
  form: UseFormReturn<TFormData>;
  fromCurrency: Currency | string | undefined;
  toCurrency: Currency | string | undefined;
  date: Date;
  amountField?: Path<TFormData>;
  toAmountField?: Path<TFormData>;
  resetKey?: boolean | number | string;
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
  resetKey,
}: UseCurrencyAmountSyncProps<TFormData>): UseCurrencyAmountSyncResult {
  const [lastEditedInput, setLastEditedInput] = useState<CurrencyAmountEditedInput>(null);

  const amountPath = amountField ?? ("amount" as Path<TFormData>);
  const toAmountPath = toAmountField ?? ("toAmount" as Path<TFormData>);
  const dateKey = getExchangeRateDateKey(date);
  const currenciesMatch = Boolean(fromCurrency && toCurrency && fromCurrency === toCurrency);
  const canLoadRate = Boolean(dateKey && fromCurrency && toCurrency && !currenciesMatch);

  const { data: loadedExchangeRate, isPending: isRatePending } = useQuery({
    queryKey: exchangeRateKeys.rate(dateKey ?? "pending", fromCurrency ?? "pending", toCurrency ?? "pending"),
    queryFn: async () => {
      const result = await getExchangeRate({
        date: `${dateKey}T00:00:00.000Z`,
        fromCurrency: fromCurrency as GetExchangeRateFromCurrency,
        toCurrency: toCurrency as GetExchangeRateToCurrency,
      });

      return result.data;
    },
    enabled: canLoadRate,
    retry: 1,
    staleTime: 60 * 60_000,
  });

  const exchangeRate = currenciesMatch ? 1 : (loadedExchangeRate ?? null);

  const setStringValue = useCallback(
    (field: Path<TFormData>, value: string) => {
      form.setValue(field, value as PathValue<TFormData, Path<TFormData>>, { shouldValidate: true });
    },
    [form]
  );

  const rateIdentity = `${dateKey ?? "invalid"}:${fromCurrency ?? "none"}:${toCurrency ?? "none"}`;
  const previousRateIdentity = useRef(rateIdentity);
  const previousResetKey = useRef(resetKey);
  const allowPersistedPairHydration = useRef(!fromCurrency || !toCurrency);

  useEffect(() => {
    if (previousRateIdentity.current === rateIdentity) {
      return;
    }

    previousRateIdentity.current = rateIdentity;
    const amount = String(form.getValues(amountPath) || "");
    const toAmount = String(form.getValues(toAmountPath) || "");
    const transition = getRateIdentityTransition({
      allowPersistedPairHydration: allowPersistedPairHydration.current,
      amount,
      lastEditedInput,
      pairIsComplete: Boolean(fromCurrency && toCurrency),
      toAmount,
    });

    allowPersistedPairHydration.current = transition.allowPersistedPairHydration;
    setLastEditedInput(transition.nextEditedInput);

    if (transition.clearField === "amount") {
      setStringValue(amountPath, "");
    } else if (transition.clearField === "toAmount") {
      setStringValue(toAmountPath, "");
    }
  }, [amountPath, form, fromCurrency, lastEditedInput, rateIdentity, setStringValue, toAmountPath, toCurrency]);

  useEffect(() => {
    if (Object.is(previousResetKey.current, resetKey)) {
      return;
    }

    previousResetKey.current = resetKey;
    allowPersistedPairHydration.current = !fromCurrency || !toCurrency;
    setLastEditedInput(null);
  }, [fromCurrency, resetKey, toCurrency]);

  const syncToAmount = useCallback(
    (value: string) => {
      if (!value) {
        setStringValue(toAmountPath, "");
        return;
      }

      if (exchangeRate === null) {
        return;
      }

      let rounded: string;
      try {
        rounded = roundMoney(multiplyMoney(value, exchangeRate.toString()));
      } catch {
        return;
      }
      if (form.getValues(toAmountPath) === rounded) {
        return;
      }

      setStringValue(toAmountPath, rounded);
    },
    [exchangeRate, form, setStringValue, toAmountPath]
  );

  const syncAmount = useCallback(
    (value: string) => {
      if (!value) {
        setStringValue(amountPath, "");
        return;
      }

      if (exchangeRate === null) {
        return;
      }

      let rounded: string;
      try {
        rounded = roundMoney(divideMoney(value, exchangeRate.toString()));
      } catch {
        return;
      }
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
    isLoadingRate: canLoadRate && isRatePending,
  };
}
