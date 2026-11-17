import { createServerFn } from "@tanstack/react-start";
import { Effect, Result, Schema } from "effect";
import {
  AccountInput,
  CategoryInput,
  CsvMapping,
  Id,
  ImportRow,
  IsoDate,
  LIMITS,
  Owner,
  RuleInput,
  Settings,
  ViewInput,
} from "#/domain/model";
import { type InvalidInput, Ledger, type LedgerError, type NotFound } from "#/server/Ledger";
import { requireEditor } from "#/server/requireEditor";
import { runServer, type ServerServices } from "#/server/runtime.server";

/**
 * Every server function of the finance app. All of them are private: each goes through
 * `requireEditor` (lint rule `messi/server-fn-guard`), and POSTs validate their input.
 */

type Failure = LedgerError | NotFound | InvalidInput;

const messageFor = (failure: Failure) => {
  switch (failure._tag) {
    case "NotFound":
      return `That ${failure.what} no longer exists. Reload to see the current state.`;
    case "InvalidInput":
      return failure.message;
    case "LedgerError":
      return "The database did not answer. Nothing was changed; try again.";
  }
};

/**
 * Runs a ledger operation and turns its failures into a message a person can act on.
 * Causes are not logged or sent: they can quote what was being stored.
 */
const call = async <A>(effect: Effect.Effect<A, Failure, ServerServices>) => {
  const result = await runServer(Effect.result(effect));
  if (Result.isFailure(result)) throw new Error(messageFor(result.failure));
  return result.success;
};

const ledger = <A>(use: (ledger: Ledger["Service"]) => Effect.Effect<A, Failure>) =>
  call(Ledger.use(use));

const Ref = Schema.Struct({ id: Id });
const Order = Schema.Struct({ ids: Schema.Array(Id).check(Schema.isMaxLength(500)) });
const optionalId = { id: Schema.optionalKey(Id) };

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .handler(({ context }) =>
    ledger((store) =>
      Effect.map(store.workspace, (workspace) => ({ ...workspace, email: context.editor.email })),
    ),
  );

const Range = Schema.Struct({ from: IsoDate, to: IsoDate });

/** The transactions of a date range, as JSON text for `decodeTransactions`. */
export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Range))
  .handler(({ data }) => ledger((store) => store.transactionsJson(data)));

const TransactionIds = Schema.Array(Id).check(Schema.isBetweenLength(1, LIMITS.bulkEdit));

const TransactionEdit = Schema.Struct({
  ids: TransactionIds,
  categoryId: Schema.optionalKey(Schema.NullOr(Id)),
  owner: Schema.optionalKey(Owner),
  note: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(LIMITS.note))),
});

export const updateTransactions = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(TransactionEdit))
  .handler(({ data }) => ledger((store) => store.updateTransactions(data)));

export const deleteTransactions = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ ids: TransactionIds })))
  .handler(({ data }) => ledger((store) => store.deleteTransactions(data.ids)));

export const saveAccount = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ ...optionalId, ...AccountInput.fields })))
  .handler(({ data }) => ledger((store) => store.saveAccount(data)));

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Ref))
  .handler(({ data }) => ledger((store) => store.deleteAccount(data.id)));

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ ...optionalId, ...CategoryInput.fields })))
  .handler(({ data }) => ledger((store) => store.saveCategory(data)));

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Ref))
  .handler(({ data }) => ledger((store) => store.deleteCategory(data.id)));

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Order))
  .handler(({ data }) => ledger((store) => store.reorderCategories(data.ids)));

/** Saves a rule and applies it to every matching transaction that wasn't set by hand. */
export const saveRule = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ ...optionalId, ...RuleInput.fields })))
  .handler(({ data }) => ledger((store) => store.saveRule(data)));

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Ref))
  .handler(({ data }) => ledger((store) => store.deleteRule(data.id)));

export const listImports = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .handler(() => ledger((store) => store.imports));

const ImportStart = Schema.Struct({
  accountId: Id,
  filename: Schema.String.check(Schema.isMaxLength(LIMITS.filename)),
  rowCount: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: LIMITS.importRows })),
  mapping: CsvMapping,
});

/** Step 1 of an upload: returns the id the lines are then added under. */
export const startImport = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(ImportStart))
  .handler(({ data }) => ledger((store) => store.startImport(data)));

const ImportLines = Schema.Struct({
  importId: Id,
  rows: Schema.Array(
    Schema.Struct({
      ...ImportRow.fields,
      seq: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: LIMITS.importRows })),
    }),
  ).check(Schema.isBetweenLength(1, LIMITS.importChunk)),
});

/** Step 2, once per `LIMITS.importChunk` lines. Lines already stored are skipped. */
export const appendImport = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(ImportLines))
  .handler(({ data }) => ledger((store) => store.appendImport(data.importId, data.rows)));

/** Step 3: categorises the new transactions and reports how many there were. */
export const finishImport = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Ref))
  .handler(({ data }) => ledger((store) => store.finishImport(data.id)));

/** Undoes an upload. */
export const deleteImport = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Ref))
  .handler(({ data }) => ledger((store) => store.deleteImport(data.id)));

export const saveView = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ ...optionalId, ...ViewInput.fields })))
  .handler(({ data }) => ledger((store) => store.saveView(data)));

export const deleteView = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Ref))
  .handler(({ data }) => ledger((store) => store.deleteView(data.id)));

export const reorderViews = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Order))
  .handler(({ data }) => ledger((store) => store.reorderViews(data.ids)));

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(Settings))
  .handler(({ data }) => ledger((store) => store.saveSettings(data)));
