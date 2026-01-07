import Big from "big.js";

export function formatMoney(amount: string | number, currency = "USD"): string {
  const bigAmount = new Big(amount);
  const [integer, decimal] = bigAmount.toFixed(2).split(".");
  const formattedInteger = new Intl.NumberFormat("ru-RU").format(Number(integer));

  let shouldAddSpace = false;

  if (currency === "BYN") {
    shouldAddSpace = true;
  }

  return `${formattedInteger}${decimal ? `.${decimal}` : ""}${shouldAddSpace ? " " : ""}${getCurrencySymbol(currency)}`;
}

export function addMoney(a: string | number, b: string | number): string {
  return new Big(a).plus(b).toString();
}

export function subtractMoney(a: string | number, b: string | number): string {
  return new Big(a).minus(b).toString();
}

export function multiplyMoney(a: string | number, b: string | number): string {
  return new Big(a).times(b).toString();
}

export function divideMoney(a: string | number, b: string | number): string {
  return new Big(a).div(b).toString();
}

export function compareMoney(a: string | number, b: string | number): number {
  const bigA = new Big(a);
  const bigB = new Big(b);
  if (bigA.gt(bigB)) return 1;
  if (bigA.lt(bigB)) return -1;
  return 0;
}

export function getCurrencySymbol(currency: string): string {
  const currencySymbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    RUB: "₽",
    BYN: "Br",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
  };
  return currencySymbols[currency] || currency;
}
