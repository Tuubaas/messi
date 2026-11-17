import { describe, expect, it } from "vite-plus/test";
import { chunks, decodeTransactions, withSequence } from "./wire";

describe("decodeTransactions", () => {
  it("names the columns the database sends and puts the newest first", () => {
    const json = JSON.stringify([
      [1, 2, "2026-10-03", -24550, "ICA", null, 0, "mine", 0, ""],
      [3, 2, "2026-10-05", -4900, "Café", 8, 1, "partner", 1, "birthday"],
      [2, 2, "2026-10-05", 100, "Refund", 7, 0, "shared", 0, ""],
    ]);
    expect(decodeTransactions(json)).toEqual([
      {
        id: 3,
        accountId: 2,
        date: "2026-10-05",
        amount: -4900,
        description: "Café",
        categoryId: 8,
        categoryManual: true,
        owner: "partner",
        ownerManual: true,
        note: "birthday",
      },
      expect.objectContaining({ id: 2, categoryManual: false, owner: "shared" }),
      expect.objectContaining({ id: 1, categoryId: null, date: "2026-10-03" }),
    ]);
  });
});

describe("withSequence", () => {
  it("numbers identical lines, and only those", () => {
    const coffee = { date: "2026-10-03", amount: -4900, description: "Café" };
    expect(
      withSequence([
        coffee,
        { ...coffee, amount: -5000 },
        coffee,
        { ...coffee, date: "2026-10-04" },
        coffee,
      ]).map((row) => row.seq),
    ).toEqual([0, 0, 1, 0, 2]);
  });
});

describe("chunks", () => {
  it("splits without losing or repeating anything", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
    expect(chunks([1, 2], 2)).toEqual([[1, 2]]);
  });
});
