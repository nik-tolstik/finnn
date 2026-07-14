export const EXCHANGE_RATE_TIME_ZONE = "Europe/Minsk";

const EXCHANGE_RATE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: EXCHANGE_RATE_TIME_ZONE,
  year: "numeric",
});

export function getExchangeRateDateKey(date: Date) {
  const dateParts = Object.fromEntries(
    EXCHANGE_RATE_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value])
  );

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function normalizeExchangeRateDate(date: Date) {
  return new Date(`${getExchangeRateDateKey(date)}T00:00:00.000Z`);
}
