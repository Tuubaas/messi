import {
  bucketKey,
  bucketLabel,
  bucketsBetween,
  bucketTitle,
  type DateRange,
  resolvePeriod,
} from "./dates";
import type { Account, Category, Owner, Transaction, ViewConfig } from "./model";

/**
 * Turns transactions into what a view shows. Pure and synchronous: the browser holds the
 * transactions of the period, so changing a view's settings redraws without a request.
 */

export type AggregateTransaction = Pick<
  Transaction,
  "date" | "amount" | "categoryId" | "accountId" | "owner"
>;

export interface AggregateContext {
  readonly categories: ReadonlyArray<Category>;
  readonly accounts: ReadonlyArray<Account>;
  /** My part of a shared transaction, 0–100. */
  readonly sharePercent: number;
  readonly today: string;
}

export interface Bucket {
  readonly key: string;
  /** Short, for an axis. */
  readonly label: string;
  /** Full, for a tooltip or a table header. */
  readonly title: string;
}

export interface Series {
  readonly key: string;
  readonly label: string;
  /** One value per bucket, in minor units. May hold halves when shared spending is split. */
  readonly values: ReadonlyArray<number>;
  readonly total: number;
}

export interface Aggregate {
  readonly range: DateRange;
  readonly buckets: ReadonlyArray<Bucket>;
  /** Largest first. */
  readonly series: ReadonlyArray<Series>;
  /** Per bucket, over every series. */
  readonly totals: ReadonlyArray<number>;
  readonly total: number;
  /** Transactions that counted. */
  readonly count: number;
}

export const UNCATEGORISED = "uncategorised";
export const OTHER = "other";

export const OWNER_LABELS: Record<Owner, string> = {
  mine: "Mine",
  shared: "Shared",
  partner: "Partner",
};

/** The days the transactions span, for the "all time" period. */
export const dataRange = (
  transactions: ReadonlyArray<Pick<Transaction, "date">>,
  today: string,
): DateRange => {
  let from = today;
  let to = today;
  for (const { date } of transactions) {
    if (date < from) from = date;
    if (date > to) to = date;
  }
  return { from, to };
};

/**
 * What one transaction adds to a measure, before any sharing split. Spending is positive
 * for money spent, so a refund in an expense category lowers it. An uncategorised
 * transaction counts by its sign. Transfers never count.
 */
const contribution = (
  measure: ViewConfig["measure"],
  amount: number,
  kind: Category["kind"] | undefined,
) => {
  const effective = kind ?? (amount < 0 ? "expense" : "income");
  if (effective === "transfer") return null;
  switch (measure) {
    case "spending":
      return effective === "expense" ? -amount : null;
    case "income":
      return effective === "income" ? amount : null;
    case "net":
      return amount;
  }
};

export const aggregate = (
  transactions: ReadonlyArray<AggregateTransaction>,
  config: ViewConfig,
  context: AggregateContext,
): Aggregate => {
  const range = resolvePeriod(config.period, context.today, dataRange(transactions, context.today));
  const keys = bucketsBetween(range, config.interval);
  const bucketIndex = new Map(keys.map((key, index) => [key, index]));
  const categories = new Map(context.categories.map((category) => [category.id, category]));
  const accounts = new Map(context.accounts.map((account) => [account.id, account]));
  const owners = new Set(config.owners);
  const accountFilter = config.accountIds === null ? null : new Set(config.accountIds);
  const categoryFilter = config.categoryIds === null ? null : new Set(config.categoryIds);
  const share = context.sharePercent / 100;

  const groupOf = (transaction: AggregateTransaction): readonly [string, string] => {
    switch (config.groupBy) {
      case "category": {
        const category =
          transaction.categoryId === null ? undefined : categories.get(transaction.categoryId);
        return category === undefined
          ? [UNCATEGORISED, "Uncategorised"]
          : [String(category.id), category.name];
      }
      case "account":
        return [
          String(transaction.accountId),
          accounts.get(transaction.accountId)?.name ?? "Deleted account",
        ];
      case "owner":
        return [transaction.owner, OWNER_LABELS[transaction.owner]];
      case "none":
        return ["total", MEASURE_LABELS[config.measure]];
    }
  };

  const groups = new Map<string, { label: string; values: Array<number> }>();
  let count = 0;
  for (const transaction of transactions) {
    if (transaction.date < range.from || transaction.date > range.to) continue;
    if (!owners.has(transaction.owner)) continue;
    if (accountFilter !== null && !accountFilter.has(transaction.accountId)) continue;
    if (
      categoryFilter !== null &&
      (transaction.categoryId === null || !categoryFilter.has(transaction.categoryId))
    ) {
      continue;
    }
    const kind =
      transaction.categoryId === null ? undefined : categories.get(transaction.categoryId)?.kind;
    const value = contribution(config.measure, transaction.amount, kind);
    const index = bucketIndex.get(bucketKey(transaction.date, config.interval));
    if (value === null || index === undefined) continue;
    const [key, label] = groupOf(transaction);
    let group = groups.get(key);
    if (group === undefined) {
      group = { label, values: keys.map(() => 0) };
      groups.set(key, group);
    }
    group.values[index] =
      (group.values[index] ?? 0) +
      (config.splitShared && transaction.owner === "shared" ? value * share : value);
    count += 1;
  }

  const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0);
  const series = [...groups]
    .map(([key, { label, values }]) => ({ key, label, values, total: sum(values) }))
    .toSorted((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.label.localeCompare(b.label));
  const totals = keys.map((_, index) => sum(series.map((entry) => entry.values[index] ?? 0)));

  return {
    range,
    buckets: keys.map((key) => ({
      key,
      label: bucketLabel(key, config.interval),
      title: bucketTitle(key, config.interval),
    })),
    series,
    totals,
    total: sum(totals),
    count,
  };
};

/**
 * Keeps the `limit` largest series and folds the rest into "Other", so a chart never has
 * more colours than a reader can tell apart.
 */
export const capSeries = (series: ReadonlyArray<Series>, limit: number): ReadonlyArray<Series> => {
  if (series.length <= limit) return series;
  const kept = series.slice(0, limit - 1);
  const rest = series.slice(limit - 1);
  const values = (rest[0]?.values ?? []).map((_, index) =>
    rest.reduce((total, entry) => total + (entry.values[index] ?? 0), 0),
  );
  return [
    ...kept,
    {
      key: OTHER,
      label: `Other (${rest.length})`,
      values,
      total: rest.reduce((total, entry) => total + entry.total, 0),
    },
  ];
};

export const MEASURE_LABELS: Record<ViewConfig["measure"], string> = {
  spending: "Spending",
  income: "Income",
  net: "Net",
};
