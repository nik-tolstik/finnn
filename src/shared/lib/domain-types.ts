type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type MoneyAmount = Brand<string, "MoneyAmount">;
export type CurrencyCode = Brand<string, "CurrencyCode">;
export type AccountId = Brand<string, "AccountId">;
export type WorkspaceId = Brand<string, "WorkspaceId">;
export type TransactionId = Brand<string, "TransactionId">;
export type DebtId = Brand<string, "DebtId">;

export type CurrencyPair = {
  from: CurrencyCode;
  to: CurrencyCode;
};

export type MoneyInput = MoneyAmount | string | number;

export function asMoneyAmount(value: string | number): MoneyAmount {
  return String(value) as MoneyAmount;
}

export function asCurrencyCode(value: string): CurrencyCode {
  return value as CurrencyCode;
}

export function makeCurrencyPair(from: string, to: string): CurrencyPair {
  return {
    from: asCurrencyCode(from),
    to: asCurrencyCode(to),
  };
}

export function asAccountId(value: string): AccountId {
  return value as AccountId;
}

export function asWorkspaceId(value: string): WorkspaceId {
  return value as WorkspaceId;
}

export function asTransactionId(value: string): TransactionId {
  return value as TransactionId;
}

export function asDebtId(value: string): DebtId {
  return value as DebtId;
}
