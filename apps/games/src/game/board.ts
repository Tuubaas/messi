import type { Board, BoardContent, Clue } from "./schema";

/** A board is always five categories of five clues. */
export const CATEGORY_COUNT = 5;
export const CLUES_PER_CATEGORY = 5;
export const CLUE_COUNT = CATEGORY_COUNT * CLUES_PER_CATEGORY;

export const DEFAULT_VALUES: ReadonlyArray<number> = [100, 200, 300, 400, 500];

/** Longest text each field accepts. The editor and the server enforce the same numbers. */
export const LIMITS = {
  title: 80,
  category: 48,
  clue: 400,
  answer: 200,
  value: 100_000,
} as const;

/** Identifies a cell as `category:row`, both zero-based. */
export type CellKey = `${number}:${number}`;

export const cellKey = (category: number, row: number): CellKey => `${category}:${row}`;

export const parseCellKey = (key: CellKey): { readonly category: number; readonly row: number } => {
  const [category, row] = key.split(":").map(Number);
  return { category: category ?? 0, row: row ?? 0 };
};

/** Every cell of a board, category by category. */
export const CELL_KEYS: ReadonlyArray<CellKey> = Array.from({ length: CLUE_COUNT }, (_, index) =>
  cellKey(Math.floor(index / CLUES_PER_CATEGORY), index % CLUES_PER_CATEGORY),
);

export const blankContent = (title: string): BoardContent => ({
  title,
  values: DEFAULT_VALUES,
  categories: Array.from({ length: CATEGORY_COUNT }, () => ({
    name: "",
    clues: Array.from({ length: CLUES_PER_CATEGORY }, () => ({ clue: "", answer: "" })),
  })),
});

export const clueAt = (content: BoardContent, key: CellKey): Clue => {
  const { category, row } = parseCellKey(key);
  return content.categories[category]?.clues[row] ?? { clue: "", answer: "" };
};

export const valueAt = (content: BoardContent, key: CellKey): number =>
  content.values[parseCellKey(key).row] ?? 0;

/** A clue can be played as soon as it has text; the answer is the host's to know. */
export const isPlayable = (clue: Clue) => clue.clue.trim() !== "";

/** A clue is ready when it has both its text and its answer. */
export const isReady = (clue: Clue) => isPlayable(clue) && clue.answer.trim() !== "";

export interface BoardProgress {
  readonly readyClues: number;
  readonly namedCategories: number;
  readonly hasTitle: boolean;
  /** Everything is filled in, so the board can be published. */
  readonly complete: boolean;
}

export const boardProgress = (content: BoardContent): BoardProgress => {
  const readyClues = content.categories
    .flatMap((category) => category.clues)
    .filter(isReady).length;
  const namedCategories = content.categories.filter(
    (category) => category.name.trim() !== "",
  ).length;
  const hasTitle = content.title.trim() !== "";
  return {
    readyClues,
    namedCategories,
    hasTitle,
    complete: hasTitle && namedCategories === CATEGORY_COUNT && readyClues === CLUE_COUNT,
  };
};

/** What still stands between a board and publishing, in the words the editor shows. */
export const missingForPublish = (content: BoardContent): ReadonlyArray<string> => {
  const progress = boardProgress(content);
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return [
    ...(progress.hasTitle ? [] : ["a title"]),
    ...(progress.namedCategories === CATEGORY_COUNT
      ? []
      : [plural(CATEGORY_COUNT - progress.namedCategories, "category name")]),
    ...(progress.readyClues === CLUE_COUNT
      ? []
      : [plural(CLUE_COUNT - progress.readyClues, "clue")]),
  ];
};

/** A board without its clues and answers: safe to list anywhere. */
export interface BoardSummary {
  readonly id: string;
  readonly title: string;
  readonly published: boolean;
  readonly categories: ReadonlyArray<string>;
  readonly readyClues: number;
  readonly complete: boolean;
  readonly updatedAt: number;
}

export const summarize = (board: Board): BoardSummary => {
  const progress = boardProgress(board);
  return {
    id: board.id,
    title: board.title,
    published: board.published,
    categories: board.categories.map((category) => category.name),
    readyClues: progress.readyClues,
    complete: progress.complete,
    updatedAt: board.updatedAt,
  };
};

export const contentOf = (board: BoardContent): BoardContent => ({
  title: board.title,
  values: board.values,
  categories: board.categories,
});
