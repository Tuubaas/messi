import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { ViewConfig } from "#/domain/model";

/**
 * The database schema, as numbered steps. Cloudflare D1 has no transactions, so a step can
 * stop halfway and be run again: **every statement must be safe to repeat** (`IF NOT
 * EXISTS`, `INSERT OR IGNORE`). Never edit a step that has shipped; add a new one.
 */
export interface Migration {
  readonly id: number;
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
}

const view = (id: number, name: string, config: ViewConfig) =>
  `(${id}, '${name.replaceAll("'", "''")}', ${id}, '${JSON.stringify(config).replaceAll("'", "''")}')`;

const baseView: ViewConfig = {
  chart: "bar",
  measure: "spending",
  groupBy: "category",
  period: { preset: "last-12-months" },
  interval: "month",
  // My own money plus what we share; my partner's own purchases on a shared card stay out.
  owners: ["mine", "shared"],
  splitShared: false,
  accountIds: null,
  categoryIds: null,
};

export const migrations: ReadonlyArray<Migration> = [
  {
    id: 1,
    name: "initial",
    statements: [
      `CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        institution TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL,
        shared INTEGER NOT NULL DEFAULT 0,
        mapping TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        position INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY,
        pattern TEXT NOT NULL UNIQUE,
        category_id INTEGER,
        owner TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS imports (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        import_id INTEGER,
        date TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        match_text TEXT NOT NULL,
        seq INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER,
        category_manual INTEGER NOT NULL DEFAULT 0,
        owner TEXT NOT NULL DEFAULT 'mine',
        owner_manual INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT ''
      )`,
      // What makes a re-upload harmless: the same line of the same account is never stored twice.
      `CREATE UNIQUE INDEX IF NOT EXISTS transactions_identity
        ON transactions (account_id, date, amount, description, seq)`,
      `CREATE INDEX IF NOT EXISTS transactions_date ON transactions (date)`,
      `CREATE INDEX IF NOT EXISTS transactions_import ON transactions (import_id)`,
      `CREATE TABLE IF NOT EXISTS views (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        position INTEGER NOT NULL,
        config TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      `INSERT OR IGNORE INTO categories (id, name, kind, position) VALUES
        (1, 'Groceries', 'expense', 1),
        (2, 'Restaurants', 'expense', 2),
        (3, 'Transport', 'expense', 3),
        (4, 'Housing', 'expense', 4),
        (5, 'Utilities', 'expense', 5),
        (6, 'Health', 'expense', 6),
        (7, 'Shopping', 'expense', 7),
        (8, 'Entertainment', 'expense', 8),
        (9, 'Travel', 'expense', 9),
        (10, 'Subscriptions', 'expense', 10),
        (11, 'Insurance', 'expense', 11),
        (12, 'Other', 'expense', 12),
        (13, 'Salary', 'income', 13),
        (14, 'Other income', 'income', 14),
        (15, 'Transfers', 'transfer', 15)`,
      `INSERT OR IGNORE INTO views (id, name, position, config) VALUES
        ${view(1, "Spending by category", baseView)},
        ${view(2, "Last month", { ...baseView, chart: "breakdown", period: { preset: "last-month" } })},
        ${view(3, "Net per month", { ...baseView, measure: "net", groupBy: "none" })},
        ${view(4, "Categories by month", {
          ...baseView,
          chart: "table",
          period: { preset: "last-6-months" },
        })},
        ${view(5, "Shared accounts: whose spending", {
          ...baseView,
          groupBy: "owner",
          period: { preset: "last-6-months" },
          owners: ["mine", "shared", "partner"],
        })}`,
    ],
  },
];

/** Brings the database up to date. Cheap when it already is: two small queries. */
export const migrate = Effect.fn("migrate")(function* (steps: ReadonlyArray<Migration>) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`;
  const [latest] = yield* sql<{ readonly id: number | null }>`
    SELECT max(id) AS id FROM schema_migrations`;
  const applied = latest?.id ?? 0;
  for (const step of steps.toSorted((a, b) => a.id - b.id)) {
    if (step.id <= applied) continue;
    for (const statement of step.statements) yield* sql.unsafe(statement);
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT OR IGNORE INTO schema_migrations (id, name, applied_at)
      VALUES (${step.id}, ${step.name}, ${now})`;
  }
});
