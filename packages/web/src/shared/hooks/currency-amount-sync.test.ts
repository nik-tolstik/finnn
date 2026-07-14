import { describe, expect, it } from "vitest";

import { getRateIdentityTransition } from "./currency-amount-sync";

describe("getRateIdentityTransition", () => {
  it("preserves persisted edit values during the first async pair hydration", () => {
    expect(
      getRateIdentityTransition({
        allowPersistedPairHydration: true,
        amount: "100",
        lastEditedInput: null,
        pairIsComplete: true,
        toAmount: "275",
      })
    ).toEqual({
      allowPersistedPairHydration: false,
      clearField: null,
      nextEditedInput: null,
    });
  });

  it("keeps the destination amount authoritative when it was edited last", () => {
    expect(
      getRateIdentityTransition({
        allowPersistedPairHydration: false,
        amount: "100",
        lastEditedInput: "toAmount",
        pairIsComplete: true,
        toAmount: "275",
      })
    ).toMatchObject({
      clearField: "amount",
      nextEditedInput: "toAmount",
    });
  });

  it("defaults to the domain amount after a user changes the rate identity", () => {
    expect(
      getRateIdentityTransition({
        allowPersistedPairHydration: false,
        amount: "100",
        lastEditedInput: "both",
        pairIsComplete: true,
        toAmount: "275",
      })
    ).toMatchObject({
      clearField: "toAmount",
      nextEditedInput: "amount",
    });
  });
});
