export type CurrencyAmountEditedInput = "amount" | "toAmount" | "both" | null;

interface GetRateIdentityTransitionInput {
  allowPersistedPairHydration: boolean;
  amount: string;
  lastEditedInput: CurrencyAmountEditedInput;
  pairIsComplete: boolean;
  toAmount: string;
}

interface RateIdentityTransition {
  allowPersistedPairHydration: boolean;
  clearField: "amount" | "toAmount" | null;
  nextEditedInput: CurrencyAmountEditedInput;
}

export function getRateIdentityTransition({
  allowPersistedPairHydration,
  amount,
  lastEditedInput,
  pairIsComplete,
  toAmount,
}: GetRateIdentityTransitionInput): RateIdentityTransition {
  const preservePersistedPair =
    allowPersistedPairHydration && pairIsComplete && lastEditedInput === null && Boolean(amount && toAmount);
  const allowNextHydration = pairIsComplete ? false : allowPersistedPairHydration;

  if (preservePersistedPair) {
    return {
      allowPersistedPairHydration: allowNextHydration,
      clearField: null,
      nextEditedInput: null,
    };
  }

  if (lastEditedInput === "toAmount" && toAmount) {
    return {
      allowPersistedPairHydration: allowNextHydration,
      clearField: "amount",
      nextEditedInput: "toAmount",
    };
  }

  return {
    allowPersistedPairHydration: allowNextHydration,
    clearField: "toAmount",
    nextEditedInput: amount ? "amount" : null,
  };
}
