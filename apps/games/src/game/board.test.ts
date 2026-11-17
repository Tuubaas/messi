import { describe, expect, it } from "vite-plus/test";
import {
  blankContent,
  boardProgress,
  CELL_KEYS,
  cellKey,
  CLUE_COUNT,
  clueAt,
  missingForPublish,
  valueAt,
} from "./board";
import { sampleBoard } from "./sample";

describe("board", () => {
  it("has 25 cells, category by category", () => {
    expect(CELL_KEYS).toHaveLength(CLUE_COUNT);
    expect(CELL_KEYS.slice(0, 6)).toEqual(["0:0", "0:1", "0:2", "0:3", "0:4", "1:0"]);
  });

  it("finds a clue and its value by cell", () => {
    expect(clueAt(sampleBoard, cellKey(1, 2)).answer).toBe("Canberra");
    expect(valueAt(sampleBoard, cellKey(1, 2))).toBe(300);
  });

  it("treats a blank board as not ready and says what is missing", () => {
    const blank = blankContent("");
    expect(boardProgress(blank)).toEqual({
      readyClues: 0,
      namedCategories: 0,
      hasTitle: false,
      complete: false,
    });
    expect(missingForPublish(blank)).toEqual(["a title", "5 category names", "25 clues"]);
  });

  it("counts a clue without an answer as not ready", () => {
    const [first, ...rest] = sampleBoard.categories;
    const content = {
      ...sampleBoard,
      categories: [
        { ...first!, clues: first!.clues.map((clue) => ({ ...clue, answer: "  " })) },
        ...rest,
      ],
    };
    expect(boardProgress(content).readyClues).toBe(20);
    expect(missingForPublish(content)).toEqual(["5 clues"]);
  });

  it("accepts the sample board as complete", () => {
    expect(boardProgress(sampleBoard).complete).toBe(true);
    expect(missingForPublish(sampleBoard)).toEqual([]);
  });
});
