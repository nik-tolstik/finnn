export const EXCHANGE_RATE_TIME_ZONE = "Europe/Minsk";

const EXCHANGE_RATE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: EXCHANGE_RATE_TIME_ZONE,
  year: "numeric",
});

const EXCHANGE_RATE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: EXCHANGE_RATE_TIME_ZONE,
  year: "numeric",
});

function getDateParts(date: Date, formatter: Intl.DateTimeFormat) {
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = getDateParts(date, EXCHANGE_RATE_DATE_TIME_FORMATTER);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const roundedTimestamp = Math.floor(date.getTime() / 1000) * 1000;

  return asUtc - roundedTimestamp;
}

function getDateStartFromKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error(`Invalid exchange-rate date: ${dateKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcGuess = new Date(Date.UTC(year, month - 1, day));
  const offset = getTimeZoneOffsetMs(utcGuess);
  const resolved = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(resolved);

  return new Date(utcGuess.getTime() - correctedOffset);
}

export function getExchangeRateDateKey(date: Date) {
  const dateParts = getDateParts(date, EXCHANGE_RATE_DATE_FORMATTER);

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function normalizeExchangeRateDate(date: Date) {
  return new Date(`${getExchangeRateDateKey(date)}T00:00:00.000Z`);
}

export function getExchangeRateDateStart(date: Date) {
  return getDateStartFromKey(getExchangeRateDateKey(date));
}

export function getExchangeRateDateEnd(date: Date) {
  const nextDate = normalizeExchangeRateDate(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  return new Date(getDateStartFromKey(getExchangeRateDateKey(nextDate)).getTime() - 1);
}
