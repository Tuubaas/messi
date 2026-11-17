/** Amounts are whole minor units (öre, cents): no floating-point money anywhere. */

/**
 * Reads an amount as a bank export writes it: `-1 234,56`, `1,234.56`, `123.45-`,
 * `(99.00)`, `−50`, `45 kr`. `decimal` says which of `,` and `.` separates the decimals;
 * the other one, spaces and apostrophes are thousands separators. `null` if it is no amount.
 */
export const parseAmount = (raw: string, decimal: "," | "."): number | null => {
  let text = raw.trim().replaceAll("−", "-");
  if (text === "") return null;
  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  // Currency codes and symbols, on either side. Anything else odd (`12:30`) stays and fails below.
  text = text.replaceAll(/[\p{L}\p{Sc}]/gu, "").trim();
  if (text.endsWith("-")) {
    negative = !negative;
    text = text.slice(0, -1);
  } else if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  const thousands = decimal === "," ? "." : ",";
  text = text.replaceAll(/[\s   ']/g, "").replaceAll(thousands, "");
  const match = /^(\d*)(?:[.,](\d*))?$/.exec(text);
  if (match === null) return null;
  const [, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return null;
  // Round half up on the third decimal (on the digits, not in floating point); banks
  // rarely print more than two.
  const digits = `${fraction}000`;
  const cents = Number(digits.slice(0, 2)) + (Number(digits.charAt(2)) >= 5 ? 1 : 0);
  const minor = Number(whole === "" ? "0" : whole) * 100 + cents;
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
};

const formatters = new Map<string, Intl.NumberFormat>();

const formatter = (key: string, options: Intl.NumberFormatOptions) => {
  const cached = formatters.get(key);
  if (cached !== undefined) return cached;
  const created = new Intl.NumberFormat(undefined, options);
  formatters.set(key, created);
  return created;
};

/** `1 234,50 kr`, in the reader's own number format. */
export const formatMoney = (minor: number, currency: string) =>
  formatter(`full:${currency}`, { style: "currency", currency }).format(minor / 100);

/** Without decimals, for totals and tables where öre are noise. */
export const formatMoneyRounded = (minor: number, currency: string) =>
  formatter(`round:${currency}`, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(minor / 100));

/** `12K`, `1.2M`: axis ticks. */
export const formatCompact = (minor: number) =>
  formatter("compact", { notation: "compact", maximumFractionDigits: 1 }).format(minor / 100);
