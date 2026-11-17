import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { Effect, Exit, type Layer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vite-plus/test";
import { blankContent } from "#/game/board";
import { sampleBoard } from "#/game/sample";
import { BoardStore, type SqlDatabase, type SqlStatement } from "./BoardStore";

/** Node's built-in SQLite behind the slice of the D1 API the store uses. */
const sqlite = (): SqlDatabase => {
  const database = new DatabaseSync(":memory:");
  const statement = (query: string, values: ReadonlyArray<SQLInputValue>): SqlStatement => ({
    bind: (...bound) => statement(query, bound),
    all: () => Promise.resolve({ results: database.prepare(query).all(...values) }),
    run: () => {
      const { changes } = database.prepare(query).run(...values);
      return Promise.resolve({ meta: { changes: Number(changes) } });
    },
  });
  return { prepare: (query) => statement(query, []) };
};

const stores: ReadonlyArray<readonly [string, () => Layer.Layer<BoardStore>]> = [
  ["memory", () => BoardStore.memory],
  ["sql", () => BoardStore.sql(sqlite())],
];

describe.each(stores)("BoardStore.%s", (_, layer) => {
  const run = <A, E>(effect: Effect.Effect<A, E, BoardStore>) =>
    Effect.runPromiseExit(Effect.provide(effect, layer()).pipe(Effect.provide(TestClock.layer())));

  const value = async <A, E>(effect: Effect.Effect<A, E, BoardStore>) => {
    const exit = await run(effect);
    if (Exit.isFailure(exit)) throw new Error(`Expected success, got ${String(exit.cause)}`);
    return exit.value;
  };

  it("creates a board and reads it back whole", async () => {
    const [created, read] = await value(
      Effect.gen(function* () {
        const store = yield* BoardStore;
        const board = yield* store.create({ content: sampleBoard, published: true });
        return [board, yield* store.get(board.id)] as const;
      }),
    );
    expect(read).toEqual(created);
    expect(read).toMatchObject({ ...sampleBoard, published: true, revision: 1 });
  });

  it("lists the most recently changed board first", async () => {
    const titles = await value(
      Effect.gen(function* () {
        const store = yield* BoardStore;
        const first = yield* store.create({ content: blankContent("First"), published: false });
        yield* TestClock.adjust("1 minute");
        yield* store.create({ content: blankContent("Second"), published: false });
        yield* TestClock.adjust("1 minute");
        yield* store.update({
          id: first.id,
          revision: first.revision,
          content: blankContent("First, edited"),
          published: false,
        });
        return (yield* store.list).map((board) => board.title);
      }),
    );
    expect(titles).toEqual(["First, edited", "Second"]);
  });

  it("saves a change and moves the revision on", async () => {
    const saved = await value(
      Effect.gen(function* () {
        const store = yield* BoardStore;
        const board = yield* store.create({ content: blankContent("Draft"), published: false });
        yield* store.update({
          id: board.id,
          revision: board.revision,
          content: sampleBoard,
          published: true,
        });
        return yield* store.get(board.id);
      }),
    );
    expect(saved).toMatchObject({ ...sampleBoard, published: true, revision: 2 });
  });

  it("refuses a save that started from an older revision, and keeps the newer one", async () => {
    const [exit, kept] = await value(
      Effect.gen(function* () {
        const store = yield* BoardStore;
        const board = yield* store.create({ content: blankContent("Draft"), published: false });
        const edit = { id: board.id, revision: board.revision, published: false };
        yield* store.update({ ...edit, content: blankContent("From this tab") });
        const stale = yield* Effect.exit(
          store.update({ ...edit, content: blankContent("From another tab") }),
        );
        return [stale, yield* store.get(board.id)] as const;
      }),
    );
    expect(Exit.isFailure(exit) && String(exit.cause)).toContain("BoardConflict");
    expect(kept.title).toBe("From this tab");
  });

  it("reports a missing board on read and on save", async () => {
    const read = await run(BoardStore.use((store) => store.get("nope")));
    expect(Exit.isFailure(read) && String(read.cause)).toContain("BoardNotFound");
    const save = await run(
      BoardStore.use((store) =>
        store.update({ id: "nope", revision: 1, content: sampleBoard, published: false }),
      ),
    );
    expect(Exit.isFailure(save) && String(save.cause)).toContain("BoardNotFound");
  });

  it("removes a board", async () => {
    const left = await value(
      Effect.gen(function* () {
        const store = yield* BoardStore;
        const board = yield* store.create({ content: sampleBoard, published: true });
        yield* store.remove(board.id);
        return yield* store.list;
      }),
    );
    expect(left).toEqual([]);
  });
});
