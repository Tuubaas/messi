import { describe, expect, it } from "vite-plus/test";
import { parseAmount } from "./money";

describe("parseAmount", () => {
  it.each([
    ["-1 234,56", ",", -123456],
    ["1.234,56", ",", 123456],
    ["1,234.56", ".", 123456],
    ["1'234.56", ".", 123456],
    ["-45", ",", -4500],
    ["45,5", ",", 4550],
    ["123.45-", ".", -12345],
    ["(99.00)", ".", -9900],
    ["−250,00", ",", -25000],
    ["+12.00", ".", 1200],
    ["45,00 kr", ",", 4500],
    ["SEK 1 000,00", ",", 100000],
    ["€ 3.50", ".", 350],
    [",50", ",", 50],
    ["0", ".", 0],
  ] as const)("reads %s (decimal %s)", (raw, decimal, expected) => {
    expect(parseAmount(raw, decimal)).toBe(expected);
  });

  it("rounds a third decimal half up, on the digits", () => {
    expect(parseAmount("0.565", ".")).toBe(57);
    expect(parseAmount("0.564", ".")).toBe(56);
    expect(parseAmount("1,005", ",")).toBe(101);
  });

  it.each(["", "  ", "abc", "2026-10-03", "12:30", "1.2.3,4,5", "-", "kr"])("rejects %j", (raw) => {
    expect(parseAmount(raw, ",")).toBeNull();
  });
});
