import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";
import { BoardContent, BoardId } from "#/game/schema";
import {
  allBoards,
  createBoard,
  duplicateBoard,
  playableBoard,
  publishedBoards,
  saveBoard,
} from "#/server/boards";
import { BoardStore } from "#/server/BoardStore";
import { requireEditor } from "#/server/requireEditor";
import { runServer } from "#/server/runtime.server";

const BoardRef = Schema.Struct({ id: BoardId });

/** `null` for a board that doesn't exist, so handlers can answer with a proper not-found. */
const orNull = <A, E, R>(effect: Effect.Effect<A, E | { readonly _tag: "BoardNotFound" }, R>) =>
  Effect.catchTag(effect, "BoardNotFound", () => Effect.succeed(null));

// public-server-fn: the front page lists published boards, without their clues or answers.
export const listPublishedBoards = createServerFn({ method: "GET" }).handler(() =>
  runServer(publishedBoards),
);

// public-server-fn: anyone may play a published board; a draft only loads for the editor.
export const getPlayableBoard = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(BoardRef))
  .handler(async ({ data }) => {
    const board = await runServer(
      orNull(playableBoard(data.id, getRequest())).pipe(
        // A draft answers exactly like a missing board, so its id gives nothing away.
        Effect.catchTag("NotEditor", () => Effect.succeed(null)),
      ),
    );
    if (board === null) throw notFound();
    return board;
  });

export const getEditor = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .handler(({ context }) => ({ email: context.editor.email }));

export const listBoards = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .handler(() => runServer(allBoards));

export const getBoard = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(BoardRef))
  .handler(async ({ data }) => {
    const board = await runServer(orNull(BoardStore.use((store) => store.get(data.id))));
    if (board === null) throw notFound();
    return board;
  });

const NewBoardInput = Schema.Struct({ template: Schema.Literals(["blank", "sample"]) });

export const createNewBoard = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(NewBoardInput))
  .handler(({ data }) =>
    runServer(createBoard(data.template).pipe(Effect.map((board) => ({ id: board.id })))),
  );

export const copyBoard = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(BoardRef))
  .handler(async ({ data }) => {
    const board = await runServer(orNull(duplicateBoard(data.id)));
    if (board === null) throw notFound();
    return { id: board.id };
  });

const SaveBoardInput = Schema.Struct({
  id: BoardId,
  revision: Schema.Int,
  published: Schema.Boolean,
  content: BoardContent,
});

/** Saves the whole board. Reports a conflict instead of overwriting a newer save. */
export const saveBoardContent = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(SaveBoardInput))
  .handler(({ data }) => runServer(saveBoard(data)));

export const deleteBoard = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(BoardRef))
  .handler(({ data }) =>
    runServer(BoardStore.use((store) => store.remove(data.id)).pipe(Effect.as({ id: data.id }))),
  );
