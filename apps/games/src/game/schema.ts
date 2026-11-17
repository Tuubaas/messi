import { Schema } from "effect";
import { CATEGORY_COUNT, CLUES_PER_CATEGORY, LIMITS } from "./board";

/**
 * The shape of a board, checked wherever one crosses a boundary: server function input
 * and rows read back from the database. Client code imports only the types from here,
 * so the play view never downloads the schema library.
 */

const text = (maxLength: number) => Schema.String.check(Schema.isMaxLength(maxLength));

const exactly = (length: number) => Schema.isBetweenLength(length, length);

export const Clue = Schema.Struct({
  clue: text(LIMITS.clue),
  answer: text(LIMITS.answer),
});
export type Clue = typeof Clue.Type;

export const Category = Schema.Struct({
  name: text(LIMITS.category),
  clues: Schema.Array(Clue).check(exactly(CLUES_PER_CATEGORY)),
});
export type Category = typeof Category.Type;

const PointValue = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: LIMITS.value }));

/** What the admin edits. */
export const BoardContent = Schema.Struct({
  title: text(LIMITS.title),
  /** Points per row, top to bottom. */
  values: Schema.Array(PointValue).check(exactly(CLUES_PER_CATEGORY)),
  categories: Schema.Array(Category).check(exactly(CATEGORY_COUNT)),
});
export type BoardContent = typeof BoardContent.Type;

export const BoardId = Schema.String.check(Schema.isBetweenLength(1, 64));

export const Board = Schema.Struct({
  id: BoardId,
  ...BoardContent.fields,
  /** Published boards are listed on the front page; drafts are only visible to the admin. */
  published: Schema.Boolean,
  /** Counts saves. Saving requires the revision the edit started from. */
  revision: Schema.Int,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export type Board = typeof Board.Type;
