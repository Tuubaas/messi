import { EditorAuth } from "@messi/access";
import { Effect } from "effect";
import {
  blankContent,
  boardProgress,
  type BoardSummary,
  contentOf,
  LIMITS,
  summarize,
} from "#/game/board";
import { sampleBoard } from "#/game/sample";
import type { Board, BoardContent } from "#/game/schema";
import { BoardStore } from "./BoardStore";

/** What the server functions do with boards, kept apart from HTTP so it can be tested. */

const summaries = (boards: ReadonlyArray<Board>): ReadonlyArray<BoardSummary> =>
  boards.map(summarize);

export const allBoards = BoardStore.use((store) => store.list).pipe(Effect.map(summaries));

export const publishedBoards = BoardStore.use((store) => store.list).pipe(
  Effect.map((boards) => summaries(boards.filter((board) => board.published))),
);

/** A board anyone may play: published ones, plus drafts when the request is the editor's. */
export const playableBoard = Effect.fn("playableBoard")(function* (id: string, request: Request) {
  const board = yield* BoardStore.use((store) => store.get(id));
  if (!board.published) yield* EditorAuth.use((auth) => auth.authenticate(request));
  return board;
});

export type BoardTemplate = "blank" | "sample";

export const createBoard = (template: BoardTemplate) =>
  BoardStore.use((store) =>
    store.create({
      content: template === "sample" ? sampleBoard : blankContent(""),
      published: false,
    }),
  );

/** Copies a board as a new draft. */
export const duplicateBoard = Effect.fn("duplicateBoard")(function* (id: string) {
  const store = yield* BoardStore;
  const original = yield* store.get(id);
  const title = `${original.title.trim() === "" ? "Untitled board" : original.title} (copy)`;
  return yield* store.create({
    content: { ...contentOf(original), title: title.slice(0, LIMITS.title) },
    published: false,
  });
});

export type SaveBoardResult =
  | { readonly _tag: "Saved"; readonly revision: number; readonly updatedAt: number }
  /** Saved elsewhere since this edit started. Nothing was overwritten. */
  | { readonly _tag: "Conflict" }
  /** Deleted since this edit started. */
  | { readonly _tag: "Gone" }
  /** Asked to publish a board that still has gaps. Nothing was saved. */
  | { readonly _tag: "Incomplete" };

export const saveBoard = Effect.fn("saveBoard")(
  function* (input: {
    readonly id: string;
    readonly revision: number;
    readonly published: boolean;
    readonly content: BoardContent;
  }) {
    const store = yield* BoardStore;
    const current = yield* store.get(input.id);
    // Only going public needs a complete board; a published one may be edited freely.
    const publishing = input.published && !current.published;
    if (publishing && !boardProgress(input.content).complete) {
      return { _tag: "Incomplete" } satisfies SaveBoardResult;
    }
    const saved = yield* store.update(input);
    return {
      _tag: "Saved",
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    } satisfies SaveBoardResult;
  },
  Effect.catchTags({
    BoardConflict: () => Effect.succeed<SaveBoardResult>({ _tag: "Conflict" }),
    BoardNotFound: () => Effect.succeed<SaveBoardResult>({ _tag: "Gone" }),
  }),
);
