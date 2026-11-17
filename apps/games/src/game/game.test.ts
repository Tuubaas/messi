import { describe, expect, it } from "vite-plus/test";
import { blankContent, CELL_KEYS, cellKey } from "./board";
import {
  type Game,
  type GameAction,
  isOpenClueTouched,
  newGame,
  play,
  readSavedGame,
  readSavedSetup,
  remainingKeys,
  scores,
  standings,
} from "./game";
import { sampleBoard } from "./sample";

const teams = [
  { id: "a", name: "Ants", color: "coral" },
  { id: "b", name: "Bees", color: "sky" },
] as const;

const start = (penalty = true) => newGame({ boardId: "board", teams, penalty, buzzers: null });

const run = (game: Game, ...actions: ReadonlyArray<GameAction>) =>
  actions.reduce((current, action) => play(current, action, sampleBoard), game);

describe("playing a clue", () => {
  it("awards the points and the next pick for a correct answer, and shows the answer", () => {
    const game = run(
      start(),
      { type: "open", key: cellKey(0, 1) },
      { type: "mark", teamId: "b", verdict: "correct" },
    );
    expect(scores(game, sampleBoard)).toEqual({ a: 0, b: 200 });
    expect(game.picker).toBe("b");
    expect(game.open).toEqual({ key: "0:1", revealed: true });
  });

  it("takes points for a wrong answer only when the penalty is on", () => {
    const actions: ReadonlyArray<GameAction> = [
      { type: "open", key: cellKey(2, 4) },
      { type: "mark", teamId: "a", verdict: "wrong" },
      { type: "mark", teamId: "b", verdict: "correct" },
      { type: "close" },
    ];
    expect(scores(run(start(true), ...actions), sampleBoard)).toEqual({ a: -500, b: 500 });
    expect(scores(run(start(false), ...actions), sampleBoard)).toEqual({ a: 0, b: 500 });
  });

  it("lets only one team be right, and a verdict be taken back", () => {
    const open = run(start(), { type: "open", key: cellKey(0, 0) });
    const moved = run(
      open,
      { type: "mark", teamId: "a", verdict: "correct" },
      { type: "mark", teamId: "b", verdict: "correct" },
    );
    expect(scores(moved, sampleBoard)).toEqual({ a: 0, b: 100 });

    const undone = run(moved, { type: "mark", teamId: "b", verdict: "correct" });
    expect(scores(undone, sampleBoard)).toEqual({ a: 0, b: 0 });

    const flipped = run(moved, { type: "mark", teamId: "b", verdict: "wrong" });
    expect(scores(flipped, sampleBoard)).toEqual({ a: 0, b: -100 });
  });

  it("leaves a clue unplayed when it is closed untouched", () => {
    const game = run(start(), { type: "open", key: cellKey(3, 3) }, { type: "close" });
    expect(game.results).toEqual({});
    expect(remainingKeys(game, sampleBoard)).toHaveLength(25);
  });

  it("counts a clue as played once its answer was shown, even if nobody scored", () => {
    const open = run(
      start(),
      { type: "open", key: cellKey(3, 3) },
      { type: "reveal", revealed: true },
    );
    expect(isOpenClueTouched(open)).toBe(true);
    const game = run(open, { type: "close" });
    expect(game.results["3:3"]).toEqual({ correct: null, wrong: [] });
    expect(remainingKeys(game, sampleBoard)).toHaveLength(24);
  });

  it("puts a played clue back on the board, score and all", () => {
    const game = run(
      start(),
      { type: "open", key: cellKey(0, 0) },
      { type: "mark", teamId: "a", verdict: "correct" },
      { type: "close" },
      { type: "open", key: cellKey(0, 0) },
      { type: "putBack" },
    );
    expect(game.results).toEqual({});
    expect(scores(game, sampleBoard)).toEqual({ a: 0, b: 0 });
  });

  it("reopens a played clue with its answer showing, for corrections", () => {
    const game = run(
      start(),
      { type: "open", key: cellKey(0, 0) },
      { type: "mark", teamId: "a", verdict: "correct" },
      { type: "close" },
      { type: "open", key: cellKey(0, 0) },
    );
    expect(game.open).toEqual({ key: "0:0", revealed: true });
  });

  it("ignores clues that have no text", () => {
    const empty = blankContent("Empty");
    const game = play(start(), { type: "open", key: cellKey(0, 0) }, empty);
    expect(game.open).toBeNull();
  });
});

describe("a whole game", () => {
  const playAll = (game: Game) =>
    CELL_KEYS.reduce(
      (current, key) =>
        run(
          current,
          { type: "open", key },
          { type: "mark", teamId: "a", verdict: "correct" },
          { type: "close" },
        ),
      game,
    );

  it("ends when the last clue is closed", () => {
    const almost = playAll(start());
    expect(almost.ended).toBe(true);
    expect(scores(almost, sampleBoard)).toEqual({ a: 7500, b: 0 });
  });

  it("can go back to the board from the results, and reopening a clue keeps it open", () => {
    const resumed = run(playAll(start()), { type: "resume" }, { type: "open", key: cellKey(0, 0) });
    expect(resumed.ended).toBe(false);
    expect(run(resumed, { type: "close" }).ended).toBe(true);
  });

  it("applies the host's corrections and ranks ties together", () => {
    const game = run(
      start(),
      { type: "adjust", teamId: "a", delta: 300 },
      { type: "adjust", teamId: "b", delta: 300 },
    );
    expect(standings(game, sampleBoard).map(({ rank }) => rank)).toEqual([1, 1]);
    const ahead = run(game, { type: "adjust", teamId: "b", delta: 100 });
    expect(standings(ahead, sampleBoard).map(({ team, rank }) => [team.id, rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("restarts with the same teams and a clean sheet", () => {
    const game = run(playAll(start()), { type: "restart" });
    expect(game).toEqual(start());
  });
});

describe("saved state", () => {
  it("reads back a game it saved", () => {
    const game = run(
      start(),
      { type: "open", key: cellKey(1, 1) },
      { type: "mark", teamId: "a", verdict: "wrong" },
    );
    expect(readSavedGame(JSON.parse(JSON.stringify(game)), "board")).toEqual(game);
  });

  it.each([
    ["another board's game", { ...start(), boardId: "other" }],
    ["no teams", { ...start(), teams: [] }],
    ["an unknown colour", { ...start(), teams: [{ id: "a", name: "A", color: "beige" }] }],
    ["a cell that doesn't exist", { ...start(), results: { "9:9": { correct: null, wrong: [] } } }],
    ["a malformed result", { ...start(), results: { "0:0": { correct: 4, wrong: [] } } }],
    ["garbage", "not a game"],
    ["nothing", null],
  ])("drops %s", (_, saved) => {
    expect(readSavedGame(saved, "board")).toBeNull();
  });

  it("falls back to two unnamed teams when the remembered setup is unusable", () => {
    expect(readSavedSetup(null).teams).toHaveLength(2);
    expect(readSavedSetup({ teams: [{ name: 3 }] }).teams).toHaveLength(2);
    // A setup remembered from before buzzers existed gets them, opening with the clue.
    expect(readSavedSetup({ teams: [{ name: "Solo", color: "lime" }], penalty: false })).toEqual({
      teams: [{ name: "Solo", color: "lime" }],
      penalty: false,
      buzzers: true,
      manual: false,
    });
    expect(
      readSavedSetup({ teams: [{ name: "Solo", color: "lime" }], buzzers: false, manual: true }),
    ).toMatchObject({ buzzers: false, manual: true });
  });

  it("keeps the buzzer room across a reload and a restart, and can move to a new code", () => {
    const buzzers = { code: "ABCD", hostKey: "secret-key", manual: true };
    const game = newGame({ boardId: "board", teams, penalty: true, buzzers });
    expect(readSavedGame(JSON.parse(JSON.stringify(game)), "board")?.buzzers).toEqual(buzzers);
    expect(run(game, { type: "restart" }).buzzers).toEqual(buzzers);
    expect(run(game, { type: "moveRoom", code: "WXYZ" }).buzzers?.code).toBe("WXYZ");
    // A game saved before buzzers existed simply has none.
    expect(readSavedGame({ ...start(), buzzers: undefined }, "board")?.buzzers).toBeNull();
  });
});
