import { describe, expect, it } from "vite-plus/test";
import { aggregate, type AggregateTransaction } from "#/domain/aggregate";
import type { Account, Category, ViewConfig } from "#/domain/model";
import { chartSeries, OTHER_COLOR } from "./series";

const categories: ReadonlyArray<Category> = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  name: `Category ${index + 1}`,
  kind: "expense",
  position: index,
}));

const accounts: ReadonlyArray<Account> = [
  { id: 1, name: "Joint", institution: "", kind: "credit", shared: true, mapping: null },
];

const config: ViewConfig = {
  chart: "bar",
  measure: "spending",
  groupBy: "category",
  period: { preset: "custom", from: "2026-10-01", to: "2026-10-31" },
  interval: "month",
  owners: ["mine", "shared", "partner"],
  splitShared: false,
  accountIds: null,
  categoryIds: null,
};

const spend = (categoryId: number | null, amount: number, owner = "mine" as const) =>
  ({
    date: "2026-10-10",
    amount: -amount,
    categoryId,
    accountId: 1,
    owner,
  }) satisfies AggregateTransaction;

const series = (transactions: ReadonlyArray<AggregateTransaction>, view = config) =>
  chartSeries(
    aggregate(transactions, view, { categories, accounts, sharePercent: 50, today: "2026-11-17" }),
    view,
    { categories, accounts },
  ).map((entry) => `${entry.label}=${entry.color}`);

describe("chartSeries", () => {
  it("hands out the hues in the order of the category list, not of the amounts", () => {
    expect(series([spend(3, 100), spend(1, 5), spend(2, 900)])).toEqual([
      "Category 1=var(--series-1)",
      "Category 2=var(--series-2)",
      "Category 3=var(--series-3)",
    ]);
  });

  it("never uses a ninth hue: the smallest series fold into a grey Other", () => {
    const all = categories.map((category) => spend(category.id, category.id * 100));
    const result = series([...all, spend(null, 5000)]);
    expect(result).toHaveLength(8);
    // The four smallest (categories 1–4) are folded; uncategorised comes after the list.
    expect(result.slice(0, 2)).toEqual([
      "Category 5=var(--series-1)",
      "Category 6=var(--series-2)",
    ]);
    expect(result.at(-2)).toBe("Uncategorised=var(--series-7)");
    expect(result.at(-1)).toBe(`Other (4)=${OTHER_COLOR}`);
  });

  it("keeps one hue per owner whoever is on screen", () => {
    const byOwner = { ...config, groupBy: "owner" } as const;
    expect(series([{ ...spend(1, 100), owner: "partner" }, spend(1, 50)], byOwner)).toEqual([
      "Mine=var(--series-1)",
      "Partner=var(--series-3)",
    ]);
  });
});
