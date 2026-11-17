import { describe, expect, it } from "vite-plus/test";
import { aggregate, type AggregateTransaction, capSeries, UNCATEGORISED } from "./aggregate";
import type { Account, Category, ViewConfig } from "./model";

const categories: ReadonlyArray<Category> = [
  { id: 1, name: "Groceries", kind: "expense", position: 0 },
  { id: 2, name: "Transport", kind: "expense", position: 1 },
  { id: 3, name: "Salary", kind: "income", position: 2 },
  { id: 4, name: "Transfers", kind: "transfer", position: 3 },
];

const accounts: ReadonlyArray<Account> = [
  { id: 1, name: "Debit", institution: "", kind: "debit", shared: false, mapping: null },
  { id: 2, name: "Joint card", institution: "", kind: "credit", shared: true, mapping: null },
];

const context = { categories, accounts, sharePercent: 50, today: "2026-11-17" };

const view = (overrides: Partial<ViewConfig> = {}): ViewConfig => ({
  chart: "bar",
  measure: "spending",
  groupBy: "category",
  period: { preset: "custom", from: "2026-09-01", to: "2026-11-30" },
  interval: "month",
  owners: ["mine", "shared", "partner"],
  splitShared: false,
  accountIds: null,
  categoryIds: null,
  ...overrides,
});

const tx = (
  date: string,
  amount: number,
  categoryId: number | null,
  overrides: Partial<AggregateTransaction> = {},
): AggregateTransaction => ({
  date,
  amount,
  categoryId,
  accountId: 1,
  owner: "mine",
  ...overrides,
});

const transactions = [
  tx("2026-09-05", -10000, 1),
  tx("2026-10-05", -20000, 1),
  tx("2026-10-20", 5000, 1), // a refund
  tx("2026-10-07", -97000, 2),
  tx("2026-10-25", 3500000, 3),
  tx("2026-10-26", -500000, 4), // paying the card bill
  tx("2026-11-02", -4900, null),
  tx("2026-11-03", 12000, null),
  tx("2026-10-10", -60000, 1, { accountId: 2, owner: "shared" }),
  tx("2026-10-11", -30000, 2, { accountId: 2, owner: "partner" }),
  tx("2026-08-31", -99900, 1), // before the period
];

const byKey = (result: ReturnType<typeof aggregate>) =>
  Object.fromEntries(result.series.map((series) => [series.key, series.values]));

describe("aggregate: measures", () => {
  it("counts spending per category and month; refunds lower it, transfers and income don't count", () => {
    const result = aggregate(transactions, view(), context);
    expect(result.buckets.map((bucket) => bucket.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(byKey(result)).toEqual({
      "1": [10000, 75000, 0],
      "2": [0, 127000, 0],
      [UNCATEGORISED]: [0, 0, 4900],
    });
    expect(result.totals).toEqual([10000, 202000, 4900]);
    expect(result.total).toBe(216900);
    expect(result.count).toBe(7);
  });

  it("orders series largest first", () => {
    const result = aggregate(transactions, view(), context);
    expect(result.series.map((series) => series.label)).toEqual([
      "Transport",
      "Groceries",
      "Uncategorised",
    ]);
  });

  it("counts income, with uncategorised money in", () => {
    const result = aggregate(transactions, view({ measure: "income" }), context);
    expect(byKey(result)).toEqual({ "3": [0, 3500000, 0], [UNCATEGORISED]: [0, 0, 12000] });
  });

  it("nets income against spending, still without transfers", () => {
    const result = aggregate(transactions, view({ measure: "net", groupBy: "none" }), context);
    expect(result.series).toHaveLength(1);
    expect(result.totals).toEqual([-10000, 3500000 - 202000, 12000 - 4900]);
  });
});

describe("aggregate: whose money", () => {
  it("can leave out my partner's transactions", () => {
    const result = aggregate(transactions, view({ owners: ["mine", "shared"] }), context);
    expect(byKey(result)["2"]).toEqual([0, 97000, 0]);
  });

  it("counts shared transactions at my share when asked to", () => {
    const mine = aggregate(
      transactions,
      view({ owners: ["mine", "shared"], splitShared: true }),
      context,
    );
    // Groceries in October: 200 − 50 of my own, plus half of the shared 600.
    expect(byKey(mine)["1"]).toEqual([10000, 45000, 0]);
    const third = aggregate(transactions, view({ owners: ["shared"], splitShared: true }), {
      ...context,
      sharePercent: 25,
    });
    expect(third.total).toBe(15000);
  });

  it("groups by owner and by account", () => {
    const owners = aggregate(transactions, view({ groupBy: "owner", interval: "year" }), context);
    expect(Object.fromEntries(owners.series.map((series) => [series.label, series.total]))).toEqual(
      { Mine: 126900, Shared: 60000, Partner: 30000 },
    );
    const perAccount = aggregate(transactions, view({ groupBy: "account" }), context);
    expect(perAccount.series.map((series) => series.label)).toEqual(["Debit", "Joint card"]);
  });
});

describe("aggregate: filters and time", () => {
  it("filters by account and by category", () => {
    expect(aggregate(transactions, view({ accountIds: [2] }), context).total).toBe(90000);
    const groceries = aggregate(transactions, view({ categoryIds: [1] }), context);
    expect(groceries.series.map((series) => series.key)).toEqual(["1"]);
  });

  it("re-buckets by week, quarter and year", () => {
    const weekly = aggregate(
      transactions,
      view({
        interval: "week",
        period: { preset: "custom", from: "2026-10-05", to: "2026-10-18" },
      }),
      context,
    );
    expect(weekly.buckets.map((bucket) => bucket.key)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(weekly.totals).toEqual([207000, 0]);
    const quarterly = aggregate(transactions, view({ interval: "quarter" }), context);
    expect(quarterly.buckets.map((bucket) => bucket.label)).toEqual(["Q3 ’26", "Q4 ’26"]);
    expect(quarterly.totals).toEqual([10000, 206900]);
  });

  it("resolves presets against today, and 'all' against the data", () => {
    const thisMonth = aggregate(transactions, view({ period: { preset: "this-month" } }), context);
    expect(thisMonth.range).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(thisMonth.total).toBe(4900);
    const all = aggregate(transactions, view({ period: { preset: "all" } }), context);
    expect(all.range).toEqual({ from: "2026-08-31", to: "2026-11-17" });
    expect(all.buckets).toHaveLength(4);
  });

  it("returns empty buckets rather than nothing when there are no transactions", () => {
    const empty = aggregate([], view(), context);
    expect(empty.buckets).toHaveLength(3);
    expect(empty.series).toEqual([]);
    expect(empty.totals).toEqual([0, 0, 0]);
  });
});

describe("capSeries", () => {
  it("folds the smallest series into Other", () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      tx("2026-10-01", -(index + 1) * 100, index + 10),
    );
    const { series } = aggregate(many, view({ groupBy: "category" }), {
      ...context,
      categories: many.map((entry, index) => ({
        id: entry.categoryId ?? 0,
        name: `C${index}`,
        kind: "expense" as const,
        position: index,
      })),
    });
    const capped = capSeries(series, 4);
    expect(capped.map((entry) => entry.label)).toEqual(["C9", "C8", "C7", "Other (7)"]);
    expect(capped.at(-1)?.total).toBe(2800);
    expect(capped.reduce((sum, entry) => sum + entry.total, 0)).toBe(5500);
    expect(capSeries(series, 10)).toBe(series);
  });
});
