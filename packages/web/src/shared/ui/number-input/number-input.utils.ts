export function normalizeNumberInputValue(value: string, allowNegative = false): string {
  const normalizedValue = value.replace(/\s/g, "").replace(/,/g, ".");
  const isNegative = allowNegative && normalizedValue.startsWith("-");
  const unsignedValue = normalizedValue.replace(/[^0-9.]/g, "");
  const parts = unsignedValue.split(".");
  const decimalValue = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : unsignedValue;

  return isNegative ? `-${decimalValue}` : decimalValue;
}
