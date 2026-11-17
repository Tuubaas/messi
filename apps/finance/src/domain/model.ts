import { Schema } from "effect";

/**
 * The shapes that cross a boundary: server function input and output, and rows read back
 * from the database. Money is always whole minor units (öre, cents); negative is money
 * out, positive is money in.
 */

export const LIMITS = {
  name: 80,
  description: 300,
  note: 300,
  pattern: 80,
  filename: 200,
  /** Rows in one upload: a few years of one card, and well inside D1's per-request limits. */
  importRows: 5000,
  /**
   * Lines per request while uploading. Checking 250 lines costs the Worker about a
   * millisecond of CPU (a few on a cold start), well inside the 10 ms of the free plan.
   */
  importChunk: 250,
  /** Transactions changed by one bulk edit. */
  bulkEdit: 2000,
} as const;

const text = (maxLength: number) => Schema.String.check(Schema.isMaxLength(maxLength));
const name = Schema.String.check(Schema.isBetweenLength(1, LIMITS.name));

export const Id = Schema.Int.check(Schema.isGreaterThan(0));
export type Id = typeof Id.Type;

/** A calendar day, `YYYY-MM-DD`. Transactions have no time of day. */
export const IsoDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));

export const OWNERS = ["mine", "shared", "partner"] as const;
/** Whose money a transaction is. Only shared accounts have anything but `mine`. */
export const Owner = Schema.Literals(OWNERS);
export type Owner = typeof Owner.Type;

export const AccountKind = Schema.Literals(["credit", "debit"]);
export type AccountKind = typeof AccountKind.Type;

export const CATEGORY_KINDS = ["expense", "income", "transfer"] as const;
/** Transfers (paying the card bill, moving savings) count as neither spending nor income. */
export const CategoryKind = Schema.Literals(CATEGORY_KINDS);
export type CategoryKind = typeof CategoryKind.Type;

const Column = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 200 }));

/** How one bank's CSV export maps onto transactions. Saved per account and reused. */
export const CsvMapping = Schema.Struct({
  /** Lines before the header (or the first transaction), e.g. an account summary. */
  skipRows: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  hasHeader: Schema.Boolean,
  dateColumn: Column,
  dateFormat: Schema.Literals(["ymd", "dmy", "mdy"]),
  /** Joined with a space, in order. */
  descriptionColumns: Schema.Array(Column).check(Schema.isBetweenLength(1, 4)),
  decimal: Schema.Literals([",", "."]),
  amount: Schema.Union([
    Schema.Struct({
      mode: Schema.Literal("single"),
      column: Column,
      /** Card exports often list purchases as positive numbers. */
      flipSign: Schema.Boolean,
    }),
    Schema.Struct({ mode: Schema.Literal("split"), outColumn: Column, inColumn: Column }),
  ]),
});
export type CsvMapping = typeof CsvMapping.Type;

export const AccountInput = Schema.Struct({
  name,
  institution: text(LIMITS.name),
  kind: AccountKind,
  /** A card or account both partners use. Its transactions can be mine, shared or my partner's. */
  shared: Schema.Boolean,
});
export type AccountInput = typeof AccountInput.Type;

export const Account = Schema.Struct({
  id: Id,
  ...AccountInput.fields,
  mapping: Schema.NullOr(CsvMapping),
});
export type Account = typeof Account.Type;

export const CategoryInput = Schema.Struct({ name, kind: CategoryKind });
export type CategoryInput = typeof CategoryInput.Type;

export const Category = Schema.Struct({
  id: Id,
  ...CategoryInput.fields,
  position: Schema.Int,
});
export type Category = typeof Category.Type;

/**
 * "Transactions whose description contains `pattern` get this category and/or owner."
 * Patterns are stored lowercase; the longest matching pattern wins.
 */
export const RuleInput = Schema.Struct({
  pattern: Schema.String.check(Schema.isBetweenLength(2, LIMITS.pattern)),
  categoryId: Schema.NullOr(Id),
  owner: Schema.NullOr(Owner),
});
export type RuleInput = typeof RuleInput.Type;

export const Rule = Schema.Struct({ id: Id, ...RuleInput.fields });
export type Rule = typeof Rule.Type;

export const Transaction = Schema.Struct({
  id: Id,
  accountId: Id,
  date: IsoDate,
  amount: Schema.Int,
  description: Schema.String,
  /** `null` is uncategorised. */
  categoryId: Schema.NullOr(Id),
  /** Set by hand: rules never change it again. */
  categoryManual: Schema.Boolean,
  owner: Owner,
  ownerManual: Schema.Boolean,
  note: Schema.String,
});
export type Transaction = typeof Transaction.Type;

/** One line of an upload, already parsed in the browser. */
export const ImportRow = Schema.Struct({
  date: IsoDate,
  amount: Schema.Int,
  description: Schema.String.check(Schema.isBetweenLength(1, LIMITS.description)),
});
export type ImportRow = typeof ImportRow.Type;

export const Import = Schema.Struct({
  id: Id,
  accountId: Id,
  filename: Schema.String,
  createdAt: Schema.Number,
  /** Lines in the file. */
  rowCount: Schema.Int,
  /** Lines that were new; the rest were already there. */
  insertedCount: Schema.Int,
});
export type Import = typeof Import.Type;

export const Settings = Schema.Struct({
  /** ISO 4217 code used to format every amount. */
  currency: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)),
  /** My part of a shared transaction, in percent, for views that split shared spending. */
  sharePercent: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
});
export type Settings = typeof Settings.Type;

export const DEFAULT_SETTINGS: Settings = { currency: "SEK", sharePercent: 50 };

export const CHARTS = ["bar", "line", "breakdown", "table"] as const;
export const MEASURES = ["spending", "income", "net"] as const;
export const GROUPINGS = ["category", "account", "owner", "none"] as const;
export const INTERVALS = ["day", "week", "month", "quarter", "year"] as const;
export const PERIOD_PRESETS = [
  "this-month",
  "last-month",
  "last-3-months",
  "last-6-months",
  "last-12-months",
  "this-year",
  "last-year",
  "all",
] as const;

export const Period = Schema.Union([
  Schema.Struct({ preset: Schema.Literals(PERIOD_PRESETS) }),
  Schema.Struct({ preset: Schema.Literal("custom"), from: IsoDate, to: IsoDate }),
]);
export type Period = typeof Period.Type;

/** One saved way of looking at the money. */
export const ViewConfig = Schema.Struct({
  chart: Schema.Literals(CHARTS),
  measure: Schema.Literals(MEASURES),
  groupBy: Schema.Literals(GROUPINGS),
  period: Period,
  interval: Schema.Literals(INTERVALS),
  /** Whose transactions count. */
  owners: Schema.Array(Owner),
  /** Count shared transactions at my share (see `Settings.sharePercent`) instead of in full. */
  splitShared: Schema.Boolean,
  /** `null` is every account. */
  accountIds: Schema.NullOr(Schema.Array(Id)),
  /** `null` is every category, including uncategorised. */
  categoryIds: Schema.NullOr(Schema.Array(Id)),
});
export type ViewConfig = typeof ViewConfig.Type;

export const ViewInput = Schema.Struct({ name, config: ViewConfig });
export type ViewInput = typeof ViewInput.Type;

export const View = Schema.Struct({ id: Id, ...ViewInput.fields, position: Schema.Int });
export type View = typeof View.Type;

/** Everything but the transactions: small, and needed on every page. */
export const Workspace = Schema.Struct({
  accounts: Schema.Array(Account),
  categories: Schema.Array(Category),
  rules: Schema.Array(Rule),
  views: Schema.Array(View),
  settings: Settings,
  /** The first and last day that has a transaction; `null` before the first import. */
  span: Schema.NullOr(Schema.Struct({ from: IsoDate, to: IsoDate })),
});
export type Workspace = typeof Workspace.Type;
