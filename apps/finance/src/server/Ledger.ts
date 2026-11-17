import { Clock, Context, Effect, Layer, Schema } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import { matchText } from "#/domain/matching";
import {
  Account,
  type AccountInput,
  Category,
  type CategoryInput,
  CsvMapping,
  DEFAULT_SETTINGS,
  Id,
  Import,
  type ImportRow,
  IsoDate,
  type Owner,
  Rule,
  type RuleInput,
  Settings,
  View,
  ViewConfig,
  type ViewInput,
  type Workspace,
} from "#/domain/model";
import { migrate, migrations } from "./migrations";

/** The database failed, or holds something that no longer fits the model. */
export class LedgerError extends Schema.TaggedError<LedgerError>()("LedgerError", {
  cause: Schema.Defect(),
}) {}

/** The account, rule, view… was deleted in the meantime. */
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  what: Schema.String,
}) {}

/** Input that has the right shape but makes no sense, with a message for the person. */
export class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {
  message: Schema.String,
}) {}

export interface TransactionEdit {
  readonly ids: ReadonlyArray<number>;
  /** `null` uncategorises. Leave out to keep the category. */
  readonly categoryId?: number | null;
  readonly owner?: Owner;
  readonly note?: string;
}

export interface ImportedRow extends ImportRow {
  /** Which of several identical lines in the file this is (0 for the first). */
  readonly seq: number;
}

const storeError = (cause: unknown) => new LedgerError({ cause });

const AccountRow = Schema.Struct({
  ...Account.fields,
  shared: Schema.BooleanFromBit,
  mapping: Schema.NullOr(Schema.fromJsonString(CsvMapping)),
});

const ViewRow = Schema.Struct({ ...View.fields, config: Schema.fromJsonString(ViewConfig) });

const SettingRow = Schema.Struct({ key: Schema.String, value: Schema.String });

const SettingsFromText = Schema.Struct({
  currency: Settings.fields.currency,
  sharePercent: Schema.FiniteFromString.pipe(Schema.decodeTo(Settings.fields.sharePercent)),
});

const IdRow = Schema.Struct({ id: Id });

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* migrate(migrations);

  const run = <A>(statement: Statement.Statement<A>) => Effect.mapError(statement, storeError);

  const query = <S extends Schema.Constraint>(
    schema: S,
    statement: Statement.Statement<unknown>,
  ): Effect.Effect<ReadonlyArray<S["Type"]>, LedgerError, S["DecodingServices"]> =>
    run(statement).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(schema))),
      Effect.mapError(storeError),
    );

  /** The first row, or `NotFound`. */
  const one = <A>(rows: Effect.Effect<ReadonlyArray<A>, LedgerError>, what: string) =>
    Effect.flatMap(rows, ([row]) =>
      row === undefined ? Effect.fail(new NotFound({ what })) : Effect.succeed(row),
    );

  const insertedId = (statement: Statement.Statement<unknown>) =>
    one(query(IdRow, statement), "inserted row").pipe(
      Effect.map((row) => row.id),
      Effect.catchTag("NotFound", (error) => Effect.fail(storeError(error))),
    );

  /** A list of ids as one bound parameter: D1 allows only 100 parameters per statement. */
  const idList = (ids: ReadonlyArray<number>) =>
    sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`;

  // --- Rules -------------------------------------------------------------------------

  /**
   * The value the winning rule gives a transaction: the longest pattern its description
   * contains, the newest rule on a tie. Category and owner are decided separately, each
   * by the rules that set it. Mirrors `winningRule` in `domain/matching.ts`.
   */
  const ruleValue = (column: "category_id" | "owner") =>
    sql.literal(
      `SELECT rules.${column} FROM rules
       WHERE rules.${column} IS NOT NULL AND instr(transactions.match_text, rules.pattern) > 0
       ORDER BY length(rules.pattern) DESC, rules.id DESC LIMIT 1`,
    );

  /** Re-derives the category of the transactions in `scope`. Never touches a manual one. */
  const applyCategoryRules = (scope: Statement.Fragment) =>
    run(sql`UPDATE transactions SET category_id = (${ruleValue("category_id")})
      WHERE category_manual = 0 AND ${scope}`);

  /**
   * Re-derives the owner. Only a shared account has owners other than me; there a
   * transaction is shared unless a rule says otherwise.
   */
  const applyOwnerRules = (scope: Statement.Fragment) =>
    run(sql`UPDATE transactions SET owner =
        CASE WHEN (SELECT accounts.shared FROM accounts WHERE accounts.id = transactions.account_id) = 1
          THEN coalesce((${ruleValue("owner")}), 'shared')
          ELSE 'mine' END
      WHERE owner_manual = 0 AND ${scope}`);

  /**
   * Rules are always applied to a scope (one import, the matches of one pattern, the
   * uncategorised after a category is deleted), never to everything: D1 bills every row a
   * statement reads, and each transaction in scope is compared with every rule.
   */
  const applyRules = (scope: Statement.Fragment) =>
    Effect.andThen(applyCategoryRules(scope), applyOwnerRules(scope));

  const matching = (pattern: string) => sql`instr(match_text, ${pattern}) > 0`;

  const rules = query(
    Rule,
    sql`SELECT id, pattern, category_id AS categoryId, owner FROM rules ORDER BY pattern`,
  );

  const saveRule = Effect.fn("Ledger.saveRule")(function* (
    input: RuleInput & { readonly id?: number },
  ) {
    const pattern = matchText(input.pattern);
    if (pattern.length < 2) {
      return yield* new InvalidInput({ message: "A rule needs at least two characters to match." });
    }
    if (input.categoryId === null && input.owner === null) {
      return yield* new InvalidInput({ message: "A rule needs a category or an owner to set." });
    }
    // Deleted in another tab meanwhile? Then say so instead of saving a rule that points nowhere.
    if (input.categoryId !== null) yield* getCategory(input.categoryId);
    let previous: string | undefined;
    if (input.id === undefined) {
      // Saving a pattern that already has a rule replaces what that rule sets.
      yield* run(sql`INSERT INTO rules (pattern, category_id, owner)
        VALUES (${pattern}, ${input.categoryId}, ${input.owner})
        ON CONFLICT (pattern) DO UPDATE SET category_id = excluded.category_id, owner = excluded.owner`);
    } else {
      const existing = yield* one(
        query(
          Schema.Struct({ pattern: Schema.String }),
          sql`SELECT pattern FROM rules WHERE id = ${input.id}`,
        ),
        "rule",
      );
      previous = existing.pattern;
      yield* run(sql`DELETE FROM rules WHERE pattern = ${pattern} AND id <> ${input.id}`);
      yield* run(sql`UPDATE rules
        SET pattern = ${pattern}, category_id = ${input.categoryId}, owner = ${input.owner}
        WHERE id = ${input.id}`);
    }
    yield* applyRules(matching(pattern));
    if (previous !== undefined && previous !== pattern) yield* applyRules(matching(previous));
    return yield* one(
      query(
        Rule,
        sql`SELECT id, pattern, category_id AS categoryId, owner FROM rules WHERE pattern = ${pattern}`,
      ),
      "rule",
    );
  });

  const deleteRule = Effect.fn("Ledger.deleteRule")(function* (id: number) {
    const [rule] = yield* query(
      Schema.Struct({ pattern: Schema.String }),
      sql`SELECT pattern FROM rules WHERE id = ${id}`,
    );
    if (rule === undefined) return;
    yield* run(sql`DELETE FROM rules WHERE id = ${id}`);
    // What it had categorised falls back to the next best rule, or to uncategorised.
    yield* applyRules(matching(rule.pattern));
  });

  // --- Accounts ----------------------------------------------------------------------

  const accounts = query(
    AccountRow,
    sql`SELECT id, name, institution, kind, shared, mapping FROM accounts ORDER BY created_at, id`,
  );

  const getAccount = (id: number) =>
    one(
      query(
        AccountRow,
        sql`SELECT id, name, institution, kind, shared, mapping FROM accounts WHERE id = ${id}`,
      ),
      "account",
    );

  const saveAccount = Effect.fn("Ledger.saveAccount")(function* (
    input: AccountInput & { readonly id?: number },
  ) {
    const shared = input.shared ? 1 : 0;
    if (input.id === undefined) {
      const now = yield* Clock.currentTimeMillis;
      const id =
        yield* insertedId(sql`INSERT INTO accounts (name, institution, kind, shared, created_at)
        VALUES (${input.name}, ${input.institution}, ${input.kind}, ${shared}, ${now}) RETURNING id`);
      return yield* getAccount(id);
    }
    const before = yield* getAccount(input.id);
    yield* run(sql`UPDATE accounts
      SET name = ${input.name}, institution = ${input.institution}, kind = ${input.kind}, shared = ${shared}
      WHERE id = ${input.id}`);
    if (before.shared && !input.shared) {
      // No longer shared: everything on it is mine again, hand-set owners included.
      yield* run(sql`UPDATE transactions SET owner = 'mine', owner_manual = 0
        WHERE account_id = ${input.id}`);
    } else if (!before.shared && input.shared) {
      yield* applyOwnerRules(sql`account_id = ${input.id}`);
    }
    return yield* getAccount(input.id);
  });

  /** Deletes the account with every transaction and import on it. */
  const deleteAccount = Effect.fn("Ledger.deleteAccount")(function* (id: number) {
    yield* run(sql`DELETE FROM transactions WHERE account_id = ${id}`);
    yield* run(sql`DELETE FROM imports WHERE account_id = ${id}`);
    yield* run(sql`DELETE FROM accounts WHERE id = ${id}`);
  });

  // --- Categories --------------------------------------------------------------------

  const categories = query(
    Category,
    sql`SELECT id, name, kind, position FROM categories ORDER BY position, id`,
  );

  const getCategory = (id: number) =>
    one(
      query(Category, sql`SELECT id, name, kind, position FROM categories WHERE id = ${id}`),
      "category",
    );

  const saveCategory = Effect.fn("Ledger.saveCategory")(function* (
    input: CategoryInput & { readonly id?: number },
  ) {
    if (input.id === undefined) {
      const id = yield* insertedId(sql`INSERT INTO categories (name, kind, position)
        VALUES (${input.name}, ${input.kind}, (SELECT coalesce(max(position), 0) + 1 FROM categories))
        RETURNING id`);
      return yield* getCategory(id);
    }
    yield* run(sql`UPDATE categories SET name = ${input.name}, kind = ${input.kind}
      WHERE id = ${input.id}`);
    return yield* getCategory(input.id);
  });

  /** Deletes a category. Its transactions become uncategorised and open to rules again. */
  const deleteCategory = Effect.fn("Ledger.deleteCategory")(function* (id: number) {
    yield* run(sql`UPDATE transactions SET category_id = NULL, category_manual = 0
      WHERE category_id = ${id}`);
    yield* run(sql`UPDATE rules SET category_id = NULL WHERE category_id = ${id}`);
    yield* run(sql`DELETE FROM rules WHERE category_id IS NULL AND owner IS NULL`);
    yield* run(sql`DELETE FROM categories WHERE id = ${id}`);
    yield* applyCategoryRules(sql`category_id IS NULL`);
  });

  /** Puts rows in the order of `ids`. One statement however many there are. */
  const reorder = (table: "categories" | "views") => (ids: ReadonlyArray<number>) => {
    const order = JSON.stringify(ids);
    return run(sql`UPDATE ${sql(table)}
      SET position = (SELECT key FROM json_each(${order}) WHERE value = ${sql(table)}.id)
      WHERE id IN (SELECT value FROM json_each(${order}))`).pipe(Effect.asVoid);
  };

  // --- Transactions ------------------------------------------------------------------

  /**
   * The transactions of a date range as JSON text: an array of
   * `[id, accountId, date, amount, description, categoryId, categoryManual, owner, ownerManual, note]`
   * (decoded by `decodeTransactions` in `domain/wire.ts`).
   *
   * The database builds the JSON and the Worker only passes the text on. A year is
   * thousands of rows, and turning them into objects and back would spend the 10 ms of
   * CPU a request gets on the Workers free plan. One row per month keeps every row far
   * below D1's 2 MB row limit.
   */
  const transactionsJson = Effect.fn("Ledger.transactionsJson")(function* (range: {
    readonly from: string;
    readonly to: string;
  }) {
    const months = yield* run(sql<{ readonly rows: string }>`
      SELECT json_group_array(json_array(
        id, account_id, date, amount, description, category_id, category_manual, owner, owner_manual, note
      )) AS rows
      FROM transactions
      WHERE date >= ${range.from} AND date <= ${range.to}
      GROUP BY substr(date, 1, 7)`);
    return `[${months.map((month) => month.rows.slice(1, -1)).join(",")}]`;
  });

  /** Sets what was given on every listed transaction and marks it as set by hand. */
  const updateTransactions = Effect.fn("Ledger.updateTransactions")(function* (
    edit: TransactionEdit,
  ) {
    const ids = idList(edit.ids);
    if (edit.categoryId !== undefined) {
      // The subquery turns a category deleted in the meantime into "uncategorised".
      yield* run(sql`UPDATE transactions
        SET category_id = (SELECT id FROM categories WHERE id = ${edit.categoryId}), category_manual = 1
        WHERE id IN ${ids}`);
    }
    if (edit.owner !== undefined) {
      yield* run(sql`UPDATE transactions SET owner = ${edit.owner}, owner_manual = 1
        WHERE id IN ${ids} AND account_id IN (SELECT id FROM accounts WHERE shared = 1)`);
    }
    if (edit.note !== undefined) {
      yield* run(sql`UPDATE transactions SET note = ${edit.note} WHERE id IN ${ids}`);
    }
  });

  const deleteTransactions = (ids: ReadonlyArray<number>) =>
    run(sql`DELETE FROM transactions WHERE id IN ${idList(ids)}`).pipe(Effect.asVoid);

  // --- Imports -----------------------------------------------------------------------

  const importColumns = sql.literal(
    `imports.id, imports.account_id AS accountId, imports.filename, imports.created_at AS createdAt,
     imports.row_count AS rowCount,
     (SELECT count(*) FROM transactions WHERE transactions.import_id = imports.id) AS insertedCount`,
  );

  const imports = query(
    Import,
    sql`SELECT ${importColumns} FROM imports ORDER BY imports.created_at DESC, imports.id DESC LIMIT 100`,
  );

  /** Opens an upload and remembers how this account's file was read, for next month. */
  const startImport = Effect.fn("Ledger.startImport")(function* (input: {
    readonly accountId: number;
    readonly filename: string;
    readonly rowCount: number;
    readonly mapping: CsvMapping;
  }) {
    yield* getAccount(input.accountId);
    const mapping = yield* Schema.encodeEffect(Schema.fromJsonString(CsvMapping))(
      input.mapping,
    ).pipe(Effect.mapError(storeError));
    yield* run(sql`UPDATE accounts SET mapping = ${mapping} WHERE id = ${input.accountId}`);
    const now = yield* Clock.currentTimeMillis;
    return yield* insertedId(sql`INSERT INTO imports (account_id, filename, row_count, created_at)
      VALUES (${input.accountId}, ${input.filename}, ${input.rowCount}, ${now}) RETURNING id`);
  });

  /**
   * Adds lines to an upload. A line that is already stored (same account, date, amount,
   * description and position among identical lines) is skipped, so uploading the same or
   * an overlapping file again never duplicates anything.
   */
  const appendImport = Effect.fn("Ledger.appendImport")(function* (
    importId: number,
    rows: ReadonlyArray<ImportedRow>,
  ) {
    const target = yield* one(
      query(
        Schema.Struct({ accountId: Id, shared: Schema.BooleanFromBit }),
        sql`SELECT imports.account_id AS accountId, accounts.shared FROM imports
          JOIN accounts ON accounts.id = imports.account_id WHERE imports.id = ${importId}`,
      ),
      "import",
    );
    // All lines travel as one JSON parameter: one statement and one bound value, whatever
    // the number of lines (D1 allows 100 parameters a statement, 50 statements a request).
    const lines = JSON.stringify(
      rows.map((row) => [
        row.date,
        row.amount,
        row.description,
        matchText(row.description),
        row.seq,
      ]),
    );
    yield* run(sql`INSERT OR IGNORE INTO transactions
        (account_id, import_id, owner, date, amount, description, match_text, seq)
      SELECT ${target.accountId}, ${importId}, ${target.shared ? "shared" : "mine"},
        json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
        json_extract(value, '$[3]'), json_extract(value, '$[4]')
      FROM json_each(${lines})`);
  });

  /** Categorises what the upload added and reports how much of it was new. */
  const finishImport = Effect.fn("Ledger.finishImport")(function* (importId: number) {
    yield* applyRules(sql`import_id = ${importId}`);
    const summary = yield* one(
      query(Import, sql`SELECT ${importColumns} FROM imports WHERE imports.id = ${importId}`),
      "import",
    );
    // An upload that added nothing leaves nothing to undo, so it is not kept in the list.
    if (summary.insertedCount === 0) {
      yield* run(sql`DELETE FROM imports WHERE id = ${importId}`);
    }
    return summary;
  });

  /** Undoes an upload: removes the transactions it added. */
  const deleteImport = Effect.fn("Ledger.deleteImport")(function* (id: number) {
    yield* run(sql`DELETE FROM transactions WHERE import_id = ${id}`);
    yield* run(sql`DELETE FROM imports WHERE id = ${id}`);
  });

  // --- Views and settings ------------------------------------------------------------

  const views = query(
    ViewRow,
    sql`SELECT id, name, position, config FROM views ORDER BY position, id`,
  );

  const getView = (id: number) =>
    one(query(ViewRow, sql`SELECT id, name, position, config FROM views WHERE id = ${id}`), "view");

  const saveView = Effect.fn("Ledger.saveView")(function* (
    input: ViewInput & { readonly id?: number },
  ) {
    const config = yield* Schema.encodeEffect(Schema.fromJsonString(ViewConfig))(input.config).pipe(
      Effect.mapError(storeError),
    );
    if (input.id === undefined) {
      const id = yield* insertedId(sql`INSERT INTO views (name, config, position)
        VALUES (${input.name}, ${config}, (SELECT coalesce(max(position), 0) + 1 FROM views))
        RETURNING id`);
      return yield* getView(id);
    }
    yield* run(
      sql`UPDATE views SET name = ${input.name}, config = ${config} WHERE id = ${input.id}`,
    );
    return yield* getView(input.id);
  });

  const deleteView = (id: number) =>
    run(sql`DELETE FROM views WHERE id = ${id}`).pipe(Effect.asVoid);

  const settings = query(SettingRow, sql`SELECT key, value FROM settings`).pipe(
    Effect.flatMap((rows) =>
      Schema.decodeUnknownEffect(SettingsFromText)({
        currency: DEFAULT_SETTINGS.currency,
        sharePercent: String(DEFAULT_SETTINGS.sharePercent),
        ...Object.fromEntries(rows.map((row) => [row.key, row.value])),
      }).pipe(Effect.mapError(storeError)),
    ),
  );

  const saveSettings = (input: Settings) =>
    run(sql`INSERT INTO settings (key, value)
      VALUES ('currency', ${input.currency}), ('sharePercent', ${String(input.sharePercent)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`).pipe(Effect.as(input));

  // Answered from the date index: cheap however many transactions there are.
  const span = query(
    Schema.Struct({ first: Schema.NullOr(IsoDate), last: Schema.NullOr(IsoDate) }),
    sql`SELECT min(date) AS first, max(date) AS last FROM transactions`,
  ).pipe(
    Effect.map(([row]) =>
      row === undefined || row.first === null || row.last === null
        ? null
        : { from: row.first, to: row.last },
    ),
  );

  const workspace: Effect.Effect<Workspace, LedgerError> = Effect.all(
    { accounts, categories, rules, views, settings, span },
    { concurrency: "unbounded" },
  );

  return {
    workspace,
    transactionsJson,
    updateTransactions,
    deleteTransactions,
    saveAccount,
    deleteAccount,
    saveCategory,
    deleteCategory,
    reorderCategories: reorder("categories"),
    saveRule,
    deleteRule,
    imports,
    startImport,
    appendImport,
    finishImport,
    deleteImport,
    saveView,
    deleteView,
    reorderViews: reorder("views"),
    saveSettings,
  };
});

/**
 * Everything the app stores: accounts, categories, rules, transactions, imports, views
 * and settings, in one SQL database (Cloudflare D1 in the Worker, SQLite in tests).
 */
export class Ledger extends Context.Service<Ledger, Effect.Success<typeof make>>()(
  "messi/finance/Ledger",
) {
  /** Needs a `SqlClient`; brings the schema up to date before the first query. */
  static readonly layer = Layer.effect(Ledger, make);
}
