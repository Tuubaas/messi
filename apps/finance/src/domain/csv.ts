import Papa from "papaparse";
import { isRealDate, isoDate } from "./dates";
import type { AccountKind, CsvMapping, ImportRow } from "./model";
import { parseAmount } from "./money";

/**
 * Reading a bank's CSV export, entirely in the browser: the file itself never leaves it,
 * only the parsed transactions do. Every bank formats its export differently, so the
 * format is guessed (`detectMapping`), shown to the user to correct, and then applied.
 */

export type Table = ReadonlyArray<ReadonlyArray<string>>;

const DESCRIPTION_LIMIT = 300;

/** Bank exports are UTF-8 or, from older systems, Windows-1252. */
export const decodeText = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

/** Splits the file into cells. The delimiter (`,` `;` tab `|`) is detected. */
export const parseTable = (text: string): Table => {
  const { data } = Papa.parse<Array<string>>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  return data.map((row) => row.map((cell) => cell.trim()));
};

type DateFormat = CsvMapping["dateFormat"];

const DATE_FORMATS: ReadonlyArray<DateFormat> = ["ymd", "dmy", "mdy"];

/** Reads a date written in `format`, ignoring a time of day after it. `null` if it isn't one. */
export const parseDate = (raw: string, format: DateFormat): string | null => {
  const text = raw.trim().split(/[\sT]/)[0] ?? "";
  let year: number;
  let month: number;
  let day: number;
  if (format === "ymd") {
    const match = /^(\d{4})[-/.]?(\d{1,2})[-/.]?(\d{1,2})$/.exec(text);
    if (match === null) return null;
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/.exec(text);
    if (match === null) return null;
    const [first, second] = [Number(match[1]), Number(match[2])];
    year = Number(match[3]) + ((match[3] ?? "").length === 2 ? 2000 : 0);
    [day, month] = format === "dmy" ? [first, second] : [second, first];
  }
  return isRealDate(year, month, day) ? isoDate(year, month, day) : null;
};

const cell = (row: ReadonlyArray<string>, column: number) => row[column] ?? "";

const share = (rows: Table, test: (row: ReadonlyArray<string>) => boolean) =>
  rows.length === 0 ? 0 : rows.filter(test).length / rows.length;

const HINTS = {
  amount: /amount|belopp|summa|beløp|beloeb|betrag|montant|importe|bedrag/i,
  out: /debit|\but\b|uttag|withdraw|paid out|money out|utgift|belast/i,
  in: /credit|kredit|\bin\b|insättning|deposit|paid in|money in|inkomst/i,
  balance: /saldo|balance|behållning/i,
  description:
    /text|beskrivning|description|merchant|payee|name|namn|specifikation|rubrik|mottagare|details|memo|narrative|transaktion/i,
};

/**
 * Guesses how a table maps onto transactions: where the header is, which column holds the
 * date (and in which order), the amount (one signed column, or one for money out and one
 * for money in), and the description. A guess only; the import page lets the user fix it.
 */
export const detectMapping = (table: Table, accountKind: AccountKind): CsvMapping => {
  const width = Math.max(0, ...table.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, column) => column);

  // The date column is the one where most lines hold a date, read in the order that fits most.
  const dateScore = (column: number, format: DateFormat) =>
    share(table, (row) => parseDate(cell(row, column), format) !== null);
  const dates = columns
    .flatMap((column) =>
      DATE_FORMATS.map((format) => ({ column, format, score: dateScore(column, format) })),
    )
    // Earlier columns and formats win ties: `sort` keeps their order.
    .toSorted((a, b) => b.score - a.score)[0] ?? { column: 0, format: "ymd" as const, score: 0 };
  const isTransaction = (row: ReadonlyArray<string>) =>
    parseDate(cell(row, dates.column), dates.format) !== null;

  // Transactions start at the first line with a date. The line above names the columns,
  // if it has several cells; anything further up is a summary the bank put on top.
  const firstTransaction = Math.max(0, table.findIndex(isTransaction));
  const above = firstTransaction > 0 ? (table[firstTransaction - 1] ?? []) : [];
  const hasHeader = above.filter((value) => /\p{L}/u.test(value)).length >= 2;
  const skipRows = hasHeader ? firstTransaction - 1 : firstTransaction;
  const header = (column: number) => (hasHeader ? cell(above, column) : "");
  const rows = table.slice(firstTransaction).filter(isTransaction);

  const numbers = rows.flatMap((row) =>
    row.filter((_, column) => column !== dates.column && /\d/.test(cell(row, column))),
  );
  const endsWith = (separator: string) =>
    numbers.filter((value) => new RegExp(`\\${separator}\\d{1,2}\\D*$`).test(value)).length;
  const decimal = endsWith(",") > endsWith(".") ? "," : ".";

  const amounts = (column: number) =>
    rows.flatMap((row) => {
      const value = cell(row, column);
      return /^[^a-zA-Z]*\d[^a-zA-Z]*$/.test(value) || /^[\d\s.,+-]+\s?[a-zA-Z]{1,3}$/.test(value)
        ? [parseAmount(value, decimal)]
        : [];
    });
  const numeric = columns.filter((column) => {
    if (column === dates.column || HINTS.balance.test(header(column))) return false;
    const parsed = amounts(column).filter((amount) => amount !== null);
    return (
      parsed.length > 0 && parsed.length >= rows.filter((row) => cell(row, column)).length * 0.8
    );
  });

  const hinted = (hint: RegExp) => numeric.find((column) => hint.test(header(column)));
  const outColumn = hinted(HINTS.out);
  const inColumn = numeric.find((column) => column !== outColumn && HINTS.in.test(header(column)));
  const hasNegative = (column: number) => amounts(column).some((amount) => (amount ?? 0) < 0);
  const single = hinted(HINTS.amount) ?? numeric.find(hasNegative) ?? numeric[0] ?? 0;

  const amount: CsvMapping["amount"] =
    hinted(HINTS.amount) === undefined && outColumn !== undefined && inColumn !== undefined
      ? { mode: "split", outColumn, inColumn }
      : {
          mode: "single",
          column: single,
          // A card statement listing purchases as positive numbers.
          flipSign:
            accountKind === "credit" &&
            share(rows, (row) => (parseAmount(cell(row, single), decimal) ?? 0) > 0) > 0.6,
        };

  const taken = new Set([
    dates.column,
    ...numeric,
    ...(amount.mode === "split" ? [amount.outColumn, amount.inColumn] : [amount.column]),
  ]);
  const wordiness = (column: number) =>
    rows.reduce((sum, row) => sum + cell(row, column).replaceAll(/[^\p{L}]/gu, "").length, 0);
  const texts = columns.filter((column) => !taken.has(column) && wordiness(column) > 0);
  const description =
    texts.find((column) => HINTS.description.test(header(column))) ??
    texts.toSorted((a, b) => wordiness(b) - wordiness(a))[0] ??
    columns.find((column) => !taken.has(column)) ??
    0;

  return {
    skipRows,
    hasHeader,
    dateColumn: dates.column,
    dateFormat: dates.format,
    descriptionColumns: [description],
    decimal,
    amount,
  };
};

/** What to call each column in the mapping form: its header, or its position. */
export const columnLabels = (table: Table, mapping: CsvMapping): ReadonlyArray<string> => {
  const width = Math.max(0, ...table.slice(mapping.skipRows).map((row) => row.length));
  const header = mapping.hasHeader ? (table[mapping.skipRows] ?? []) : [];
  return Array.from({ length: width }, (_, column) => {
    const label = cell(header, column);
    return label === "" ? `Column ${column + 1}` : label;
  });
};

export interface SkippedLine {
  /** 1-based line of the table, as a spreadsheet would number it. */
  readonly line: number;
  readonly reason: string;
}

export interface MappedTable {
  readonly rows: ReadonlyArray<ImportRow>;
  readonly skipped: ReadonlyArray<SkippedLine>;
}

/** Turns the table into transactions. Lines that are no transaction are reported, not guessed at. */
export const applyMapping = (table: Table, mapping: CsvMapping): MappedTable => {
  const rows: Array<ImportRow> = [];
  const skipped: Array<SkippedLine> = [];
  const start = mapping.skipRows + (mapping.hasHeader ? 1 : 0);
  for (const [index, row] of table.entries()) {
    if (index < start || row.every((value) => value === "")) continue;
    const line = index + 1;
    const date = parseDate(cell(row, mapping.dateColumn), mapping.dateFormat);
    if (date === null) {
      skipped.push({ line, reason: "No date" });
      continue;
    }
    let amount: number | null;
    if (mapping.amount.mode === "single") {
      const value = parseAmount(cell(row, mapping.amount.column), mapping.decimal);
      amount = value !== null && mapping.amount.flipSign ? -value : value;
    } else {
      const out = parseAmount(cell(row, mapping.amount.outColumn), mapping.decimal);
      const into = parseAmount(cell(row, mapping.amount.inColumn), mapping.decimal);
      amount = out === null && into === null ? null : Math.abs(into ?? 0) - Math.abs(out ?? 0);
    }
    if (amount === null) {
      skipped.push({ line, reason: "No amount" });
      continue;
    }
    const description = mapping.descriptionColumns
      .map((column) => cell(row, column))
      .filter((value) => value !== "")
      .join(" ")
      .replaceAll(/\s+/g, " ")
      .slice(0, DESCRIPTION_LIMIT);
    // `-0` would not survive the trip to the server as an integer.
    rows.push({ date, amount: amount + 0, description: description || "(no description)" });
  }
  return { rows, skipped };
};
