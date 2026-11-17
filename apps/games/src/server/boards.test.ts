import { EditorAuth } from "@messi/access";
import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { blankContent } from "#/game/board";
import { sampleBoard } from "#/game/sample";
import {
  allBoards,
  createBoard,
  duplicateBoard,
  playableBoard,
  publishedBoards,
  saveBoard,
} from "./boards";
import { BoardStore } from "./BoardStore";

const asEditor = EditorAuth.development;
const asVisitor = EditorAuth.locked("Not signed in.");

const run = <A, E>(
  effect: Effect.Effect<A, E, BoardStore | EditorAuth>,
  auth: Layer.Layer<EditorAuth> = asVisitor,
) => Effect.runPromiseExit(Effect.provide(effect, Layer.mergeAll(BoardStore.memory, auth)));

const value = async <A, E>(
  effect: Effect.Effect<A, E, BoardStore | EditorAuth>,
  auth?: Layer.Layer<EditorAuth>,
) => {
  const exit = await run(effect, auth);
  if (Exit.isFailure(exit)) throw new Error(`Expected success, got ${String(exit.cause)}`);
  return exit.value;
};

const request = new Request("https://games.test/play/x");

const create = (published: boolean, content = sampleBoard) =>
  BoardStore.use((store) => store.create({ content, published }));

describe("listing boards", () => {
  it("shows visitors only published boards, and never clues or answers", async () => {
    const [listed, all] = await value(
      Effect.gen(function* () {
        yield* create(true);
        yield* create(false, blankContent("Secret draft"));
        return [yield* publishedBoards, yield* allBoards] as const;
      }),
    );
    expect(listed.map((board) => board.title)).toEqual(["Sample board"]);
    expect(all).toHaveLength(2);
    expect(JSON.stringify(listed)).not.toContain("Canberra");
    expect(listed[0]).toMatchObject({ readyClues: 25, complete: true, published: true });
  });
});

describe("opening a board to play", () => {
  it("gives anyone a published board", async () => {
    const board = await value(
      Effect.flatMap(create(true), (created) => playableBoard(created.id, request)),
    );
    expect(board.title).toBe("Sample board");
  });

  it("keeps a draft from visitors but lets the editor preview it", async () => {
    const open = Effect.flatMap(create(false), (created) => playableBoard(created.id, request));
    const visitor = await run(open, asVisitor);
    expect(Exit.isFailure(visitor) && String(visitor.cause)).toContain("NotEditor");
    expect((await value(open, asEditor)).published).toBe(false);
  });

  it("reports a board that doesn't exist", async () => {
    const exit = await run(playableBoard("nope", request));
    expect(Exit.isFailure(exit) && String(exit.cause)).toContain("BoardNotFound");
  });
});

describe("creating boards", () => {
  it("starts blank or from the sample, always as a draft", async () => {
    const [blank, sample] = await value(Effect.all([createBoard("blank"), createBoard("sample")]));
    expect(blank).toMatchObject({ title: "", published: false });
    expect(sample).toMatchObject({ ...sampleBoard, published: false });
  });

  it("duplicates a board as a draft with a new name", async () => {
    const copy = await value(
      Effect.flatMap(create(true), (created) =>
        Effect.map(duplicateBoard(created.id), (duplicate) => ({ created, duplicate })),
      ),
    );
    expect(copy.duplicate.id).not.toBe(copy.created.id);
    expect(copy.duplicate).toMatchObject({
      title: "Sample board (copy)",
      published: false,
      categories: sampleBoard.categories,
    });
  });
});

describe("saving a board", () => {
  it("saves and returns the next revision", async () => {
    const result = await value(
      Effect.flatMap(create(false, blankContent("Draft")), (board) =>
        saveBoard({
          id: board.id,
          revision: board.revision,
          published: false,
          content: sampleBoard,
        }),
      ),
    );
    expect(result).toMatchObject({ _tag: "Saved", revision: 2 });
  });

  it("refuses to publish a board with gaps, and saves nothing", async () => {
    const [result, stored] = await value(
      Effect.gen(function* () {
        const board = yield* create(false, blankContent("Draft"));
        const outcome = yield* saveBoard({
          id: board.id,
          revision: board.revision,
          published: true,
          content: blankContent("Renamed"),
        });
        return [outcome, yield* BoardStore.use((store) => store.get(board.id))] as const;
      }),
    );
    expect(result).toEqual({ _tag: "Incomplete" });
    expect(stored).toMatchObject({ title: "Draft", published: false, revision: 1 });
  });

  it("lets a published board be edited into an incomplete state without unpublishing it", async () => {
    const result = await value(
      Effect.flatMap(create(true), (board) =>
        saveBoard({
          id: board.id,
          revision: board.revision,
          published: true,
          content: { ...sampleBoard, title: "" },
        }),
      ),
    );
    expect(result._tag).toBe("Saved");
  });

  it("reports a conflict for a stale revision and a deleted board as gone", async () => {
    const [conflict, gone] = await value(
      Effect.gen(function* () {
        const board = yield* create(false);
        const edit = { id: board.id, revision: board.revision, published: false };
        yield* saveBoard({ ...edit, content: sampleBoard });
        const stale = yield* saveBoard({ ...edit, content: blankContent("Stale") });
        yield* BoardStore.use((store) => store.remove(board.id));
        return [stale, yield* saveBoard({ ...edit, content: sampleBoard })] as const;
      }),
    );
    expect(conflict).toEqual({ _tag: "Conflict" });
    expect(gone).toEqual({ _tag: "Gone" });
  });
});
