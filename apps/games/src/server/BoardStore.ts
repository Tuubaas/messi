import { Clock, Context, Effect, Layer, Ref, Result, Schema } from "effect";
import { Board, BoardContent } from "#/game/schema";

/** No board has this id (any more). */
export class BoardNotFound extends Schema.TaggedError<BoardNotFound>()("BoardNotFound", {}) {}

/** The board was saved elsewhere since this edit started, e.g. in another tab. */
export class BoardConflict extends Schema.TaggedError<BoardConflict>()("BoardConflict", {}) {}

export class BoardStoreError extends Schema.TaggedError<BoardStoreError>()("BoardStoreError", {
  cause: Schema.Defect(),
}) {}

export interface NewBoard {
  readonly content: BoardContent;
  readonly published: boolean;
}

export interface BoardUpdate extends NewBoard {
  readonly id: string;
  /** The revision the edit started from. */
  readonly revision: number;
}

/**
 * The part of Cloudflare D1's API the store uses. `D1Database` satisfies it, and so does
 * a small adapter over Node's built-in SQLite in tests.
 */
export interface SqlDatabase {
  prepare(query: string): SqlStatement;
}

export interface SqlStatement {
  bind(...values: ReadonlyArray<string | number>): SqlStatement;
  all(): Promise<{ readonly results: ReadonlyArray<unknown> }>;
  run(): Promise<{ readonly meta: { readonly changes: number } }>;
}

/**
 * One table, created on first use: there is nothing to migrate yet, and it keeps a fresh
 * deploy or checkout working without a setup step (docs/decisions/0010-tubas-games.md).
 */
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  published INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL
)`;

const COLUMNS = "id, title, published, revision, created_at, updated_at, data";

/** The clues live in one JSON column: a board is always read and written whole. */
const BoardData = Schema.fromJsonString(
  Schema.Struct({
    values: BoardContent.fields.values,
    categories: BoardContent.fields.categories,
  }),
);

const BoardRow = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  published: Schema.Number,
  revision: Schema.Int,
  created_at: Schema.Number,
  updated_at: Schema.Number,
  data: BoardData,
});

const decodeRows = Schema.decodeUnknownEffect(Schema.Array(BoardRow));
const encodeData = Schema.encodeEffect(BoardData);
const checkBoard = Schema.decodeUnknownEffect(Board);

const fromRow = (row: typeof BoardRow.Type): Board => ({
  id: row.id,
  title: row.title,
  values: row.data.values,
  categories: row.data.categories,
  published: row.published !== 0,
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const newBoardId = Effect.sync(() => crypto.randomUUID().replaceAll("-", "").slice(0, 12));

const storeError = (cause: unknown) => new BoardStoreError({ cause });

/** Where boards are kept. */
export class BoardStore extends Context.Service<
  BoardStore,
  {
    /** Every board, most recently changed first. */
    readonly list: Effect.Effect<ReadonlyArray<Board>, BoardStoreError>;
    get(id: string): Effect.Effect<Board, BoardNotFound | BoardStoreError>;
    create(input: NewBoard): Effect.Effect<Board, BoardStoreError>;
    update(
      input: BoardUpdate,
    ): Effect.Effect<Board, BoardNotFound | BoardConflict | BoardStoreError>;
    remove(id: string): Effect.Effect<void, BoardStoreError>;
  }
>()("messi/games/BoardStore") {
  /** In-memory store for tests. */
  static readonly memory = Layer.effect(
    BoardStore,
    Effect.gen(function* () {
      const boards = yield* Ref.make<ReadonlyMap<string, Board>>(new Map());
      const put =
        (board: Board) =>
        (all: ReadonlyMap<string, Board>): ReadonlyMap<string, Board> =>
          new Map(all).set(board.id, board);
      return BoardStore.of({
        list: Ref.get(boards).pipe(
          Effect.map((all) => [...all.values()].toSorted((a, b) => b.updatedAt - a.updatedAt)),
        ),
        get: (id) =>
          Ref.get(boards).pipe(
            Effect.flatMap((all) => Effect.fromNullishOr(all.get(id))),
            Effect.mapError(() => new BoardNotFound()),
          ),
        create: Effect.fnUntraced(function* ({ content, published }: NewBoard) {
          const now = yield* Clock.currentTimeMillis;
          const board = yield* checkBoard({
            id: yield* newBoardId,
            ...content,
            published,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          }).pipe(Effect.mapError(storeError));
          yield* Ref.update(boards, put(board));
          return board;
        }),
        update: Effect.fnUntraced(function* ({ id, revision, content, published }: BoardUpdate) {
          const now = yield* Clock.currentTimeMillis;
          const result = yield* Ref.modify(
            boards,
            (
              all,
            ): readonly [
              Result.Result<Board, BoardNotFound | BoardConflict>,
              ReadonlyMap<string, Board>,
            ] => {
              const current = all.get(id);
              if (current === undefined) return [Result.fail(new BoardNotFound()), all];
              if (current.revision !== revision) return [Result.fail(new BoardConflict()), all];
              const next = {
                ...current,
                ...content,
                published,
                revision: revision + 1,
                updatedAt: now,
              };
              return [Result.succeed(next), put(next)(all)];
            },
          );
          return yield* Effect.fromResult(result);
        }),
        remove: (id) =>
          Ref.update(boards, (all) => new Map([...all].filter(([other]) => other !== id))),
      });
    }),
  );

  static readonly makeSql = Effect.fnUntraced(function* (db: SqlDatabase) {
    const created = yield* Ref.make(false);
    /** Runs `use` against the database, creating the table first if this is a fresh start. */
    const query = <A>(use: (db: SqlDatabase) => Promise<A>) =>
      Effect.gen(function* () {
        if (!(yield* Ref.get(created))) {
          yield* Effect.tryPromise({
            try: () => db.prepare(CREATE_TABLE).run(),
            catch: storeError,
          });
          yield* Ref.set(created, true);
        }
        return yield* Effect.tryPromise({ try: () => use(db), catch: storeError });
      });

    const select = (where: string, ...values: ReadonlyArray<string | number>) =>
      query((db) =>
        db
          .prepare(`SELECT ${COLUMNS} FROM boards ${where}`)
          .bind(...values)
          .all(),
      ).pipe(
        Effect.flatMap(({ results }) => Effect.mapError(decodeRows(results), storeError)),
        Effect.map((rows) => rows.map(fromRow)),
      );

    const get = Effect.fn("BoardStore.get")(function* (id: string) {
      const [board] = yield* select("WHERE id = ?", id);
      return board ?? (yield* new BoardNotFound());
    });

    const create = Effect.fn("BoardStore.create")(function* ({ content, published }: NewBoard) {
      const id = yield* newBoardId;
      const now = yield* Clock.currentTimeMillis;
      const data = yield* Effect.mapError(encodeData(content), storeError);
      yield* query((db) =>
        db
          .prepare(`INSERT INTO boards (${COLUMNS}) VALUES (?, ?, ?, 1, ?, ?, ?)`)
          .bind(id, content.title, published ? 1 : 0, now, now, data)
          .run(),
      );
      return yield* Effect.catchTag(get(id), "BoardNotFound", (error) =>
        Effect.fail(storeError(error)),
      );
    });

    const update = Effect.fn("BoardStore.update")(function* (input: BoardUpdate) {
      const now = yield* Clock.currentTimeMillis;
      const data = yield* Effect.mapError(encodeData(input.content), storeError);
      const { meta } = yield* query((db) =>
        db
          .prepare(
            `UPDATE boards SET title = ?, published = ?, data = ?, updated_at = ?, revision = revision + 1
             WHERE id = ? AND revision = ?`,
          )
          .bind(input.content.title, input.published ? 1 : 0, data, now, input.id, input.revision)
          .run(),
      );
      const board = yield* get(input.id);
      // Nothing changed although the board exists: it has moved on from `input.revision`.
      return meta.changes === 0 ? yield* new BoardConflict() : board;
    });

    return BoardStore.of({
      list: select("ORDER BY updated_at DESC").pipe(Effect.withSpan("BoardStore.list")),
      get,
      create,
      update,
      remove: Effect.fn("BoardStore.remove")(function* (id: string) {
        yield* query((db) => db.prepare("DELETE FROM boards WHERE id = ?").bind(id).run());
      }),
    });
  });

  /** Boards in a SQL database: Cloudflare D1 in the Worker. */
  static readonly sql = (db: SqlDatabase) => Layer.effect(BoardStore, BoardStore.makeSql(db));
}
