import { describe, expect, it } from "vite-plus/test";
import { matchText, suggestPattern, winningRule } from "./matching";

describe("matchText", () => {
  it("lowercases beyond ASCII and collapses spaces", () => {
    expect(matchText("  ICA  NÄRA\tÖSTERMALM ")).toBe("ica nära östermalm");
  });
});

describe("suggestPattern", () => {
  it.each([
    ["ICA NARA STOCKHOLM 2026-10-03", "ica nara stockholm"],
    ["KORTKÖP 261003 ESPRESSO HOUSE 4471", "kortköp espresso house"],
    ["SPOTIFY *P2A91C00F2", "spotify"],
    ["Netflix.com", "netflix.com"],
    ["12345", "12345"],
  ])("suggests a pattern for %s", (description, pattern) => {
    expect(suggestPattern(description)).toBe(pattern);
  });
});

describe("winningRule", () => {
  const rules = [
    { id: 1, pattern: "ica" },
    { id: 2, pattern: "ica banken" },
    { id: 3, pattern: "sl" },
    { id: 4, pattern: "ab" },
  ];

  it("prefers the longest matching pattern", () => {
    expect(winningRule(rules, "ica banken avgift")?.id).toBe(2);
    expect(winningRule(rules, "ica nära")?.id).toBe(1);
  });

  it("prefers the newest rule when patterns are equally long", () => {
    expect(winningRule(rules, "sl ab")?.id).toBe(4);
  });

  it("finds nothing when no pattern is contained", () => {
    expect(winningRule(rules, "coop")).toBeUndefined();
  });
});
