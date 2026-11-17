import type { Period } from "./model";

/**
 * Calendar-day arithmetic on `YYYY-MM-DD` strings. Transactions have no time of day, so
 * everything here runs in UTC and never touches the local time zone (except `today`).
 */

export type Interval = "day" | "week" | "month" | "quarter" | "year";

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** `month` is 1–12. */
export const isoDate = (year: number, month: number, day: number) =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

const toUtc = (date: string) =>
  new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8))));

const fromUtc = (date: Date) =>
  isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

/**
 * Whether the three numbers name a day that exists (no 31 February), in a year a bank
 * export can contain. A misread date must not stretch "all time" over a century.
 */
export const isRealDate = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || year < 1970 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

/** Today in the browser's time zone. */
export const today = (now: Date = new Date()) =>
  isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

export const addDays = (date: string, days: number) => {
  const next = toUtc(date);
  next.setUTCDate(next.getUTCDate() + days);
  return fromUtc(next);
};

/** The first day of the month `months` away from the month of `date`. */
const monthStart = (date: string, months = 0) => {
  const start = toUtc(date);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() + months);
  return fromUtc(start);
};

const monthEnd = (date: string, months = 0) => addDays(monthStart(date, months + 1), -1);

/** Weeks start on Monday. */
const weekStart = (date: string) => addDays(date, -((toUtc(date).getUTCDay() + 6) % 7));

const quarterOf = (date: string) => Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1;

/** The bucket a day falls in. Keys of one interval sort in time order. */
export const bucketKey = (date: string, interval: Interval): string => {
  switch (interval) {
    case "day":
      return date;
    case "week":
      return weekStart(date);
    case "month":
      return date.slice(0, 7);
    case "quarter":
      return `${date.slice(0, 4)}-Q${quarterOf(date)}`;
    case "year":
      return date.slice(0, 4);
  }
};

const nextBucketStart = (date: string, interval: Interval): string => {
  switch (interval) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addDays(weekStart(date), 7);
    case "month":
      return monthStart(date, 1);
    case "quarter":
      return monthStart(`${date.slice(0, 4)}-${pad((quarterOf(date) - 1) * 3 + 1)}-01`, 3);
    case "year":
      return `${pad(Number(date.slice(0, 4)) + 1, 4)}-01-01`;
  }
};

/** Every bucket from `from` to `to`, including the ones nothing happened in. */
export const bucketsBetween = ({ from, to }: DateRange, interval: Interval) => {
  const keys: Array<string> = [];
  for (let date = from; date <= to; date = nextBucketStart(date, interval)) {
    keys.push(bucketKey(date, interval));
  }
  return keys;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthName = (month: string) => MONTHS[Number(month) - 1] ?? month;

/** A short axis label, e.g. `Oct ’26`, `12 Oct`, `Q4 ’26`. */
export const bucketLabel = (key: string, interval: Interval): string => {
  // With the apostrophe, "Dec ’25" cannot be read as the 25th of December.
  const shortYear = `’${key.slice(2, 4)}`;
  switch (interval) {
    case "day":
    case "week":
      return `${Number(key.slice(8))} ${monthName(key.slice(5, 7))}`;
    case "month":
      return `${monthName(key.slice(5, 7))} ${shortYear}`;
    case "quarter":
      return `${key.slice(5)} ${shortYear}`;
    case "year":
      return key;
  }
};

/** The full name of a bucket, for tooltips and table headers. */
export const bucketTitle = (key: string, interval: Interval): string => {
  switch (interval) {
    case "day":
      return formatDate(key);
    case "week":
      return `Week of ${formatDate(key)}`;
    case "month":
      return `${monthName(key.slice(5, 7))} ${key.slice(0, 4)}`;
    case "quarter":
      return `${key.slice(5)} ${key.slice(0, 4)}`;
    case "year":
      return key;
  }
};

/** `12 Oct 2026`. */
export const formatDate = (date: string) =>
  `${Number(date.slice(8))} ${monthName(date.slice(5, 7))} ${date.slice(0, 4)}`;

/**
 * The days a period covers. "Last 3 months" is the current month and the two before it,
 * so it always shows whole months. `all` needs the range the data spans.
 */
export const resolvePeriod = (period: Period, now: string, all: DateRange): DateRange => {
  switch (period.preset) {
    case "custom":
      return period.from <= period.to
        ? { from: period.from, to: period.to }
        : { from: period.to, to: period.from };
    case "this-month":
      return { from: monthStart(now), to: monthEnd(now) };
    case "last-month":
      return { from: monthStart(now, -1), to: monthEnd(now, -1) };
    case "last-3-months":
      return { from: monthStart(now, -2), to: monthEnd(now) };
    case "last-6-months":
      return { from: monthStart(now, -5), to: monthEnd(now) };
    case "last-12-months":
      return { from: monthStart(now, -11), to: monthEnd(now) };
    case "this-year":
      return { from: `${now.slice(0, 4)}-01-01`, to: `${now.slice(0, 4)}-12-31` };
    case "last-year": {
      const year = pad(Number(now.slice(0, 4)) - 1, 4);
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case "all":
      return all;
  }
};

export const PERIOD_LABELS: Record<Period["preset"], string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  "last-6-months": "Last 6 months",
  "last-12-months": "Last 12 months",
  "this-year": "This year",
  "last-year": "Last year",
  all: "All time",
  custom: "Custom",
};
