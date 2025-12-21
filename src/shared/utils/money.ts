import Big from "big.js";

export function formatMoney(amount: string | number, currency = "USD"): string {
  const bigAmount = new Big(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(bigAmount.toString()));
}

export function addMoney(a: string | number, b: string | number): string {
  return new Big(a).plus(b).toString();
}

export function subtractMoney(a: string | number, b: string | number): string {
  return new Big(a).minus(b).toString();
}

export function multiplyMoney(
  a: string | number,
  b: string | number
): string {
  return new Big(a).times(b).toString();
}

export function divideMoney(a: string | number, b: string | number): string {
  return new Big(a).div(b).toString();
}

export function compareMoney(
  a: string | number,
  b: string | number
): number {
  const bigA = new Big(a);
  const bigB = new Big(b);
  if (bigA.gt(bigB)) return 1;
  if (bigA.lt(bigB)) return -1;
  return 0;
}

