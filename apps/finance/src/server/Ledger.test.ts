import { SqliteClient } from "@effect/sql-sqlite-node";
import { Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { describe, expect, it } from "vite-plus/test";
import type { CsvMapping, ImportRow, ViewConfig } from "#/domain/model";
import { decodeTransactions, withSequence } from "#/domain/wire";
import { Ledger } from "./Ledger";
import { migrate, migrations } from "./migrations";

/** The real schema and the real SQL, in an in-memory SQLite. D1 is SQLite too. */
const database = () => SqliteClient.layer({ filename: ":memory:" });

const run = <A, E>(effect: Effect.Effect<A, E, Ledger | SqlClient.SqlClient>) =>
  Effect.runPromiseExit(Effect.provide(effect, Ledger.layer.pipe(Layer.provideMerge(database()))));

const value = async <A, E>(effect: Effect.Effect<A, E, Ledger | SqlClient.SqlClient>) => {
  const exit = await run(effect);
  if (Exit.isFailure(exit)) throw new Error(`Expected success, got ${String(exit.cause)}`);
  return exit.value;
};

const mapping: CsvMapping = {
  skipRows: 0,
  hasHeader: true,
  dateColumn: 0,
  dateFormat: "ymd",
  descriptionColumns: [1],
  decimal: ",",
  amount: { mode: "single", column: 2, flipSign: false },
};

const everything = { from: "0000-01-01", to: "9999-12-31" };

const upload = Effect.fn(function* (accountId: number, rows: ReadonlyArray<ImportRow>) {
  const ledger = yield* Ledger;
  const importId = yield* ledger.startImport({
    accountId,
    filename: "export.csv",
    rowCount: rows.length,
    mapping,
  });
  yield* ledger.appendImport(importId, withSequence(rows));
  return yield* ledger.finishImport(importId);
});

const listed = Effect.gen(function* () {
  const ledger = yield* Ledger;
  return decodeTransactions(yield* ledger.transactionsJson(everything));
});

const october: ReadonlyArray<ImportRow> = [
  { date: "2026-10-03", amount: -24550, description: "ICA NÄRA SÖDER" },
  { date: "2026-10-03", amount: -4900, description: "Espresso House" },
  { date: "2026-10-03", amount: -4900, description: "Espresso House" },
  { date: "2026-10-05", amount: -97000, description: "SL" },
  { date: "2026-10-25", amount: 3500000, description: "LÖN ACME AB" },
];

const debit = { name: "Everyday", institution: "Bank", kind: "debit", shared: false } as const;
const joint = { name: "Joint card", institution: "Bank", kind: "credit", shared: true } as const;

describe("migrations", () => {
  it("start a fresh database with categories and views, and can run again", async () => {
    const workspace = await value(
      Effect.gen(function* () {
        yield* migrate(migrations);
        yield* migrate(migrations);
        return yield* (yield* Ledger).workspace;
      }),
    );
    expect(workspace.categories.map((category) => category.name)).toContain("Groceries");
    expect(workspace.categories).toHaveLength(15);
    expect(workspace.views.length).toBeGreaterThan(0);
    expect(workspace.settings).toEqual({ currency: "SEK", sharePercent: 50 });
    expect(workspace.accounts).toEqual([]);
    expect(workspace.span).toBeNull();
  });

  it("are safe to repeat statement by statement, as a half-finished run on D1 would", async () => {
    const tables = await value(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        for (const step of migrations) {
          for (const statement of step.statements) yield* sql.unsafe(statement);
        }
        return yield* sql<{ count: number }>`SELECT count(*) AS count FROM categories`;
      }),
    );
    expect(tables[0]?.count).toBe(15);
  });
});

describe("imports", () => {
  it("store every line, keep identical purchases apart, and read back whole", async () => {
    const [summary, transactions] = await value(
      Effect.gen(function* () {
        const account = yield* (yield* Ledger).saveAccount(debit);
        return [yield* upload(account.id, october), yield* listed] as const;
      }),
    );
    expect(summary).toMatchObject({ rowCount: 5, insertedCount: 5, filename: "export.csv" });
    expect(transactions.map((transaction) => transaction.description)).toEqual([
      "LÖN ACME AB",
      "SL",
      "Espresso House",
      "Espresso House",
      "ICA NÄRA SÖDER",
    ]);
    expect(transactions[0]).toMatchObject({
      date: "2026-10-25",
      amount: 3500000,
      categoryId: null,
      categoryManual: false,
      owner: "mine",
      ownerManual: false,
      note: "",
    });
  });

  it("never duplicate: the same file again, or an overlapping one, only adds what is new", async () => {
    const [again, overlapping, total, imports] = await value(
      Effect.gen(function* () {
        const account = yield* (yield* Ledger).saveAccount(debit);
        yield* upload(account.id, october);
        const again = yield* upload(account.id, october);
        const overlapping = yield* upload(account.id, [
          ...october.slice(3),
          { date: "2026-11-01", amount: -1000, description: "Kiosk" },
        ]);
        return [
          again,
          overlapping,
          (yield* listed).length,
          yield* (yield* Ledger).imports,
        ] as const;
      }),
    );
    expect(again).toMatchObject({ rowCount: 5, insertedCount: 0 });
    expect(overlapping).toMatchObject({ rowCount: 3, insertedCount: 1 });
    expect(total).toBe(6);
    // The upload that added nothing is not listed: there is nothing in it to undo.
    expect(imports.map((entry) => entry.insertedCount)).toEqual([1, 5]);
  });

  it("keep the same line on two accounts apart", async () => {
    const total = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const first = yield* ledger.saveAccount(debit);
        const second = yield* ledger.saveAccount(joint);
        yield* upload(first.id, october);
        yield* upload(second.id, october);
        return (yield* listed).length;
      }),
    );
    expect(total).toBe(10);
  });

  it("remember the account's file format and can be undone", async () => {
    const [saved, imports, left] = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        const first = yield* upload(account.id, october.slice(0, 1));
        yield* upload(account.id, october.slice(3));
        yield* ledger.deleteImport(first.id);
        const workspace = yield* ledger.workspace;
        return [workspace.accounts[0]?.mapping, yield* ledger.imports, yield* listed] as const;
      }),
    );
    expect(saved).toEqual(mapping);
    expect(imports).toHaveLength(1);
    expect(left.map((entry) => entry.description)).toEqual(["LÖN ACME AB", "SL"]);
  });

  it("refuse an upload for an account that is gone", async () => {
    const exit = await run(upload(999, october));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("rules", () => {
  const categoryOf = (transactions: ReturnType<typeof decodeTransactions>, description: string) =>
    transactions.find((transaction) => transaction.description === description)?.categoryId;

  it("categorise what is there and what is uploaded later; the longest pattern wins", async () => {
    const [before, after] = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, october);
        // Beyond ASCII on purpose: the pattern must match "ICA NÄRA SÖDER".
        yield* ledger.saveRule({ pattern: "ICA Nära", categoryId: 1, owner: null });
        yield* ledger.saveRule({ pattern: "ica", categoryId: 12, owner: null });
        const before = yield* listed;
        yield* upload(account.id, [
          { date: "2026-11-02", amount: -30000, description: "ICA NÄRA SÖDER" },
          { date: "2026-11-03", amount: -5000, description: "ICA BANKEN AVGIFT" },
        ]);
        return [before, yield* listed] as const;
      }),
    );
    expect(categoryOf(before, "ICA NÄRA SÖDER")).toBe(1);
    expect(categoryOf(before, "SL")).toBeNull();
    expect(categoryOf(after, "ICA BANKEN AVGIFT")).toBe(12);
    expect(
      after
        .filter((transaction) => transaction.description === "ICA NÄRA SÖDER")
        .map((transaction) => transaction.categoryId),
    ).toEqual([1, 1]);
  });

  it("never override a category set by hand", async () => {
    const transactions = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, october);
        const coffees = (yield* listed).filter((entry) => entry.description === "Espresso House");
        yield* ledger.updateTransactions({ ids: [coffees[0]?.id ?? 0], categoryId: 8 });
        yield* ledger.saveRule({ pattern: "espresso house", categoryId: 2, owner: null });
        return yield* listed;
      }),
    );
    const coffees = transactions.filter((entry) => entry.description === "Espresso House");
    expect(
      Object.fromEntries(coffees.map((entry) => [entry.categoryId, entry.categoryManual])),
    ).toEqual({ 2: false, 8: true });
  });

  it("fall back to the next best rule, then to uncategorised, when a rule changes or goes", async () => {
    const steps = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, october);
        yield* ledger.saveRule({ pattern: "ica", categoryId: 12, owner: null });
        const specific = yield* ledger.saveRule({
          pattern: "ica nära",
          categoryId: 1,
          owner: null,
        });
        const first = categoryOf(yield* listed, "ICA NÄRA SÖDER");
        // Repointing the specific rule at another shop frees the transaction for the general one.
        yield* ledger.saveRule({ id: specific.id, pattern: "coop", categoryId: 1, owner: null });
        const second = categoryOf(yield* listed, "ICA NÄRA SÖDER");
        const [general] = (yield* ledger.workspace).rules.filter((rule) => rule.pattern === "ica");
        yield* ledger.deleteRule(general?.id ?? 0);
        return [first, second, categoryOf(yield* listed, "ICA NÄRA SÖDER")];
      }),
    );
    expect(steps).toEqual([1, 12, null]);
  });

  it("replace the rule that already has the pattern", async () => {
    const rules = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        yield* ledger.saveRule({ pattern: "SL", categoryId: 3, owner: null });
        yield* ledger.saveRule({ pattern: "sl", categoryId: 9, owner: null });
        return (yield* ledger.workspace).rules;
      }),
    );
    expect(rules).toMatchObject([{ pattern: "sl", categoryId: 9 }]);
  });

  it("need something to set and something to match", async () => {
    const exits = await Promise.all([
      run(
        Ledger.use((ledger) => ledger.saveRule({ pattern: "ica", categoryId: null, owner: null })),
      ),
      run(Ledger.use((ledger) => ledger.saveRule({ pattern: " a ", categoryId: 1, owner: null }))),
    ]);
    expect(exits.every(Exit.isFailure)).toBe(true);
  });
});

describe("shared accounts", () => {
  const owners = (transactions: ReturnType<typeof decodeTransactions>) =>
    Object.fromEntries(
      transactions.map((transaction) => [
        `${transaction.description} ${transaction.id}`,
        transaction.owner,
      ]),
    );

  it("start every transaction as shared; a private account's are mine", async () => {
    const transactions = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        yield* upload((yield* ledger.saveAccount(joint)).id, october.slice(0, 1));
        yield* upload((yield* ledger.saveAccount(debit)).id, october.slice(3, 4));
        return yield* listed;
      }),
    );
    expect(transactions.map((transaction) => transaction.owner)).toEqual(["mine", "shared"]);
  });

  it("let one transaction be mine or my partner's, and rules decide for a shop", async () => {
    const transactions = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(joint);
        yield* upload(account.id, october);
        const sl = (yield* listed).find((entry) => entry.description === "SL");
        yield* ledger.updateTransactions({ ids: [sl?.id ?? 0], owner: "partner" });
        yield* ledger.saveRule({ pattern: "espresso", categoryId: null, owner: "mine" });
        // A rule for the same shop must not undo the choice made by hand.
        yield* ledger.saveRule({ pattern: "sl", categoryId: 3, owner: "shared" });
        return yield* listed;
      }),
    );
    expect(
      transactions.map((entry) => [entry.description, entry.owner, entry.ownerManual]),
    ).toEqual([
      ["LÖN ACME AB", "shared", false],
      ["SL", "partner", true],
      ["Espresso House", "mine", false],
      ["Espresso House", "mine", false],
      ["ICA NÄRA SÖDER", "shared", false],
    ]);
    expect(transactions.find((entry) => entry.description === "SL")?.categoryId).toBe(3);
  });

  it("ignore owners on an account that is not shared", async () => {
    const transactions = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* ledger.saveRule({ pattern: "sl", categoryId: null, owner: "partner" });
        yield* upload(account.id, october);
        yield* ledger.updateTransactions({
          ids: (yield* listed).map((entry) => entry.id),
          owner: "partner",
        });
        return yield* listed;
      }),
    );
    expect(new Set(transactions.map((entry) => entry.owner))).toEqual(new Set(["mine"]));
  });

  it("follow the account when it becomes shared, or stops being shared", async () => {
    const [shared, privateAgain] = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, october.slice(0, 2));
        yield* ledger.saveRule({ pattern: "espresso", categoryId: null, owner: "mine" });
        yield* ledger.saveAccount({ ...joint, id: account.id });
        const ica = (yield* listed).find((entry) => entry.description === "ICA NÄRA SÖDER");
        const shared = owners(yield* listed);
        yield* ledger.updateTransactions({ ids: [ica?.id ?? 0], owner: "partner" });
        yield* ledger.saveAccount({ ...debit, id: account.id });
        return [shared, yield* listed] as const;
      }),
    );
    expect(Object.values(shared).toSorted()).toEqual(["mine", "shared"]);
    expect(privateAgain.map((entry) => [entry.owner, entry.ownerManual])).toEqual([
      ["mine", false],
      ["mine", false],
    ]);
  });
});

describe("editing", () => {
  it("edits many transactions at once, adds notes, and deletes", async () => {
    const transactions = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, october);
        const all = yield* listed;
        const ids = all.map((entry) => entry.id);
        yield* ledger.updateTransactions({ ids, categoryId: 7, note: "checked" });
        yield* ledger.updateTransactions({ ids: ids.slice(0, 1), categoryId: null });
        yield* ledger.deleteTransactions(ids.slice(3));
        return yield* listed;
      }),
    );
    expect(
      transactions.map((entry) => [entry.categoryId, entry.categoryManual, entry.note]),
    ).toEqual([
      [null, true, "checked"],
      [7, true, "checked"],
      [7, true, "checked"],
    ]);
  });

  it("uncategorises instead of pointing at a category that no longer exists", async () => {
    const transactions = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, october.slice(0, 1));
        yield* ledger.updateTransactions({ ids: [(yield* listed)[0]?.id ?? 0], categoryId: 4242 });
        return yield* listed;
      }),
    );
    expect(transactions[0]?.categoryId).toBeNull();
  });

  it("limits a date range", async () => {
    const dates = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        yield* upload(account.id, [
          ...october,
          { date: "2026-11-01", amount: -1, description: "Later" },
          { date: "2026-09-30", amount: -1, description: "Earlier" },
        ]);
        const json = yield* ledger.transactionsJson({ from: "2026-10-01", to: "2026-10-31" });
        const { span } = yield* ledger.workspace;
        return [decodeTransactions(json).length, (yield* listed).length, span] as const;
      }),
    );
    expect(dates).toEqual([5, 7, { from: "2026-09-30", to: "2026-11-01" }]);
    expect(decodeTransactions("[]")).toEqual([]);
  });
});

describe("categories", () => {
  it("are created last, renamed, and reordered", async () => {
    const names = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const pets = yield* ledger.saveCategory({ name: "Pets", kind: "expense" });
        yield* ledger.saveCategory({ id: 1, name: "Food", kind: "expense" });
        const ids = (yield* ledger.workspace).categories.map((category) => category.id);
        yield* ledger.reorderCategories([pets.id, ...ids.filter((id) => id !== pets.id)]);
        return (yield* ledger.workspace).categories.map((category) => category.name).slice(0, 3);
      }),
    );
    expect(names).toEqual(["Pets", "Food", "Restaurants"]);
  });

  it("when deleted, free their transactions for other rules and drop their own rules", async () => {
    const [transactions, rules, count] = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(joint);
        yield* upload(account.id, october);
        yield* ledger.saveRule({ pattern: "ica", categoryId: 12, owner: null });
        yield* ledger.saveRule({ pattern: "ica nära", categoryId: 1, owner: null });
        yield* ledger.saveRule({ pattern: "sl", categoryId: 1, owner: "mine" });
        const lön = (yield* listed).find((entry) => entry.description === "LÖN ACME AB");
        yield* ledger.updateTransactions({ ids: [lön?.id ?? 0], categoryId: 1 });
        yield* ledger.deleteCategory(1);
        const workspace = yield* ledger.workspace;
        return [yield* listed, workspace.rules, workspace.categories.length] as const;
      }),
    );
    expect(count).toBe(14);
    // The rule that also sets an owner survives as an owner-only rule.
    expect(rules).toEqual([
      { id: 1, pattern: "ica", categoryId: 12, owner: null },
      { id: 3, pattern: "sl", categoryId: null, owner: "mine" },
    ]);
    expect(
      Object.fromEntries(
        transactions.map((entry) => [entry.description, [entry.categoryId, entry.categoryManual]]),
      ),
    ).toMatchObject({
      "ICA NÄRA SÖDER": [12, false],
      SL: [null, false],
      "LÖN ACME AB": [null, false],
    });
  });
});

describe("accounts, views and settings", () => {
  it("delete an account with its transactions and imports", async () => {
    const [transactions, imports, accounts] = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const account = yield* ledger.saveAccount(debit);
        const other = yield* ledger.saveAccount(joint);
        yield* upload(account.id, october);
        yield* upload(other.id, october.slice(0, 1));
        yield* ledger.deleteAccount(account.id);
        return [yield* listed, yield* ledger.imports, (yield* ledger.workspace).accounts] as const;
      }),
    );
    expect(transactions).toHaveLength(1);
    expect(imports).toHaveLength(1);
    expect(accounts.map((account) => account.name)).toEqual(["Joint card"]);
  });

  it("save, reorder and delete views", async () => {
    const config: ViewConfig = {
      chart: "table",
      measure: "net",
      groupBy: "owner",
      period: { preset: "custom", from: "2026-01-01", to: "2026-06-30" },
      interval: "quarter",
      owners: ["shared"],
      splitShared: true,
      accountIds: [1],
      categoryIds: null,
    };
    const views = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const created = yield* ledger.saveView({ name: "Mine", config });
        yield* ledger.saveView({ id: created.id, name: "Ours", config });
        const ids = (yield* ledger.workspace).views.map((view) => view.id);
        yield* ledger.deleteView(ids[0] ?? 0);
        yield* ledger.reorderViews([created.id, ...ids.slice(1, -1)]);
        return (yield* ledger.workspace).views;
      }),
    );
    expect(views[0]).toMatchObject({ name: "Ours", config, position: 0 });
    expect(views.map((view) => view.position)).toEqual(views.map((_, index) => index));
  });

  it("save settings", async () => {
    const settings = await value(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        yield* ledger.saveSettings({ currency: "EUR", sharePercent: 60 });
        yield* ledger.saveSettings({ currency: "NOK", sharePercent: 40 });
        return (yield* ledger.workspace).settings;
      }),
    );
    expect(settings).toEqual({ currency: "NOK", sharePercent: 40 });
  });

  it("answer NotFound for what was deleted meanwhile", async () => {
    const exit = await run(Ledger.use((ledger) => ledger.saveAccount({ ...debit, id: 12 })));
    expect(Exit.isFailure(exit) && String(exit.cause)).toContain("NotFound");
  });
});

describe("rules and categories that are gone", () => {
  it("refuse a rule for a category that no longer exists", async () => {
    const exit = await run(
      Ledger.use((ledger) => ledger.saveRule({ pattern: "ica", categoryId: 4242, owner: null })),
    );
    expect(Exit.isFailure(exit) && String(exit.cause)).toContain("NotFound");
  });
});
