import { describe, expect, it } from "vite-plus/test";
import {
  applyMapping,
  columnLabels,
  decodeText,
  detectMapping,
  parseDate,
  parseTable,
} from "./csv";

/** Made-up exports in the shapes banks really use. No real transactions. */
const nordicBank = [
  "Bokföringsdag;Transaktionsdag;Text;Belopp;Saldo",
  "2026-10-03;2026-10-02;ICA NÄRA SÖDER;-245,50;12 345,67",
  '2026-10-04;2026-10-04;"LÖN; ACME AB";35 000,00;47 345,67',
  "2026-10-05;2026-10-05;SL;-970,00;46 375,67",
  "",
].join("\r\n");

const cardStatement = [
  "Card statement,,,",
  "Card,5555 **** 4444,,",
  "Date,Description,Amount,Currency",
  "03/10/2026,ESPRESSO HOUSE STOCKHOLM,49.00,SEK",
  '15/10/2026,"SL, STOCKHOLM",970.00,SEK',
  "28/10/2026,PAYMENT RECEIVED,-5000.00,SEK",
  "Total,,-3981.00,SEK",
].join("\n");

const splitColumns = [
  "Date\tDetails\tPaid out\tPaid in\tBalance",
  "03.10.2026\tGROCER\t12.50\t\t987.50",
  "04.10.2026\tSALARY\t\t2,500.00\t3,487.50",
].join("\n");

const noHeader = ["10/31/2026,BOOKSHOP,-12.99", "11/01/2026,REFUND BOOKSHOP,12.99"].join("\n");

describe("decodeText", () => {
  it("reads UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("KÖP"))).toBe("KÖP");
  });

  it("falls back to Windows-1252 for exports from older bank systems", () => {
    expect(decodeText(new Uint8Array([0x4b, 0xd6, 0x50]))).toBe("KÖP");
  });
});

describe("parseDate", () => {
  it.each([
    ["2026-10-03", "ymd", "2026-10-03"],
    ["20261003", "ymd", "2026-10-03"],
    ["2026/10/03 14:22", "ymd", "2026-10-03"],
    ["2026-10-03T14:22:00", "ymd", "2026-10-03"],
    ["03.10.2026", "dmy", "2026-10-03"],
    ["3/10/26", "dmy", "2026-10-03"],
    ["10/31/2026", "mdy", "2026-10-31"],
  ] as const)("reads %s as %s", (raw, format, expected) => {
    expect(parseDate(raw, format)).toBe(expected);
  });

  it.each([
    ["31/02/2026", "dmy"],
    ["10/31/2026", "dmy"],
    ["Date", "ymd"],
    ["", "ymd"],
    ["-245,50", "ymd"],
  ] as const)("rejects %j as %s", (raw, format) => {
    expect(parseDate(raw, format)).toBeNull();
  });
});

describe("a Nordic bank export: semicolons, decimal commas, a balance column", () => {
  const table = parseTable(`﻿${nordicBank}`);
  const mapping = detectMapping(table, "debit");

  it("detects the format", () => {
    expect(mapping).toEqual({
      skipRows: 0,
      hasHeader: true,
      dateColumn: 0,
      dateFormat: "ymd",
      descriptionColumns: [2],
      decimal: ",",
      amount: { mode: "single", column: 3, flipSign: false },
    });
  });

  it("names the columns after the header", () => {
    expect(columnLabels(table, mapping)).toEqual([
      "Bokföringsdag",
      "Transaktionsdag",
      "Text",
      "Belopp",
      "Saldo",
    ]);
  });

  it("reads every transaction, quoted delimiters included", () => {
    expect(applyMapping(table, mapping)).toEqual({
      rows: [
        { date: "2026-10-03", amount: -24550, description: "ICA NÄRA SÖDER" },
        { date: "2026-10-04", amount: 3500000, description: "LÖN; ACME AB" },
        { date: "2026-10-05", amount: -97000, description: "SL" },
      ],
      skipped: [],
    });
  });
});

describe("a card statement: summary lines on top, purchases as positive numbers", () => {
  const table = parseTable(cardStatement);
  const mapping = detectMapping(table, "credit");

  it("finds the header below the summary and flips the sign", () => {
    expect(mapping).toMatchObject({
      skipRows: 2,
      hasHeader: true,
      dateColumn: 0,
      dateFormat: "dmy",
      descriptionColumns: [1],
      decimal: ".",
      amount: { mode: "single", column: 2, flipSign: true },
    });
  });

  it("imports purchases as money out and reports the total line instead of guessing", () => {
    expect(applyMapping(table, mapping)).toEqual({
      rows: [
        { date: "2026-10-03", amount: -4900, description: "ESPRESSO HOUSE STOCKHOLM" },
        { date: "2026-10-15", amount: -97000, description: "SL, STOCKHOLM" },
        { date: "2026-10-28", amount: 500000, description: "PAYMENT RECEIVED" },
      ],
      skipped: [{ line: 7, reason: "No date" }],
    });
  });

  it("keeps the sign for a debit account", () => {
    expect(detectMapping(table, "debit").amount).toMatchObject({ flipSign: false });
  });
});

describe("an export with separate columns for money out and money in", () => {
  const table = parseTable(splitColumns);
  const mapping = detectMapping(table, "debit");

  it("detects both columns and ignores the balance", () => {
    expect(mapping).toMatchObject({
      dateFormat: "dmy",
      decimal: ".",
      amount: { mode: "split", outColumn: 2, inColumn: 3 },
    });
  });

  it("signs the amounts", () => {
    expect(applyMapping(table, mapping).rows).toEqual([
      { date: "2026-10-03", amount: -1250, description: "GROCER" },
      { date: "2026-10-04", amount: 250000, description: "SALARY" },
    ]);
  });
});

describe("an export without a header, month first", () => {
  const table = parseTable(noHeader);
  const mapping = detectMapping(table, "debit");

  it("detects it", () => {
    expect(mapping).toMatchObject({
      skipRows: 0,
      hasHeader: false,
      dateFormat: "mdy",
      amount: { mode: "single", column: 2, flipSign: false },
    });
    expect(columnLabels(table, mapping)).toEqual(["Column 1", "Column 2", "Column 3"]);
  });

  it("reads both lines", () => {
    expect(applyMapping(table, mapping).rows).toHaveLength(2);
  });
});

describe("applyMapping", () => {
  it("joins several description columns and reports lines without an amount", () => {
    const table = parseTable("2026-10-03;Shop;Stockholm;-1,00\n2026-10-04;Shop;;n/a");
    const result = applyMapping(table, {
      skipRows: 0,
      hasHeader: false,
      dateColumn: 0,
      dateFormat: "ymd",
      descriptionColumns: [1, 2],
      decimal: ",",
      amount: { mode: "single", column: 3, flipSign: false },
    });
    expect(result).toEqual({
      rows: [{ date: "2026-10-03", amount: -100, description: "Shop Stockholm" }],
      skipped: [{ line: 2, reason: "No amount" }],
    });
  });
});
