import Big from "big.js";

import { Currency } from "@/shared/constants/currency";

export function formatMoney(amount: string | number, currency: string = Currency.USD): string {
  const bigAmount = new Big(amount);
  const [integer, decimal] = bigAmount.toFixed(2).split(".");
  const formattedInteger = new Intl.NumberFormat("ru-RU").format(Number(integer));

  let shouldAddSpace = false;

  if (currency === Currency.BYN) {
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

export function formatMoneyByMagnitude(amount: string | number, currency: string = Currency.USD): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  let formatted: string;
  let magnitude: string;

  if (absNum >= 1_000_000_000) {
    formatted = (absNum / 1_000_000_000).toFixed(1);
    magnitude = "b";
  } else if (absNum >= 1_000_000) {
    formatted = (absNum / 1_000_000).toFixed(1);
    magnitude = "m";
  } else if (absNum >= 1_000) {
    formatted = (absNum / 1_000).toFixed(1);
    magnitude = "k";
  } else {
    formatted = absNum.toFixed(0);
    magnitude = "";
  }

  const currencySymbol = getCurrencySymbol(currency);
  const shouldAddSpace = currency === Currency.BYN;

  return `${sign}${formatted}${magnitude}${shouldAddSpace ? " " : ""}${currencySymbol}`;
}
