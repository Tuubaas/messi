const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "yesterday", "just now". */
export const timeAgo = (then: number, now: number = Date.now()) => {
  const elapsed = then - now;
  for (const [unit, length] of UNITS) {
    if (Math.abs(elapsed) >= length) return format.format(Math.round(elapsed / length), unit);
  }
  return "just now";
};
