import { describe, expect, it } from "vite-plus/test";
import { cellKey } from "#/game/board";
import { type Game, type GameAction, newGame, play } from "#/game/game";
import { sampleBoard } from "#/game/sample";
import { boardSnapshot, roundCommand, wantedRound } from "./host";
import type { Round } from "./room";

const teams = [
  { id: "a", name: "Ants", color: "coral" },
  { id: "b", name: "Bees", color: "sky" },
] as const;

const start = () =>
  newGame({
    boardId: "board",
    teams,
    penalty: true,
    buzzers: { code: "ABCD", hostKey: "secret-key", manual: false },
  });

const run = (game: Game, ...actions: ReadonlyArray<GameAction>) =>
  actions.reduce((current, action) => play(current, action, sampleBoard), game);

const openClue = () => run(start(), { type: "open", key: cellKey(1, 2) });

const round = (change: Partial<Round> = {}): Round => ({
  key: "1:2",
  phase: "open",
  eligible: ["a", "b"],
  openAt: 100,
  winner: null,
  ...change,
});

describe("keeping the room in step with the game", () => {
  it("asks for nothing while the board is showing", () => {
    expect(wantedRound(start())).toBeNull();
    expect(roundCommand(start(), null, 5)).toBeNull();
  });

  it("starts a round when a clue opens, for every team", () => {
    expect(roundCommand(openClue(), null, 5)).toEqual({
      t: "round",
      key: "1:2",
      eligible: ["a", "b"],
      clear: false,
      at: 5,
    });
  });

  it("says nothing more once the room has the round", () => {
    expect(roundCommand(openClue(), round(), 5)).toBeNull();
    expect(roundCommand(openClue(), round({ phase: "answering" }), 5)).toBeNull();
  });

  it("takes a team out when it answers wrong, which reopens the buzzers for the rest", () => {
    const game = run(openClue(), { type: "mark", teamId: "a", verdict: "wrong" });
    expect(roundCommand(game, round({ phase: "answering" }), 9)).toEqual({
      t: "round",
      key: "1:2",
      eligible: ["b"],
      clear: false,
      at: 9,
    });
  });

  it("ends the round on a right answer, a shown answer, a closed clue and the end of the game", () => {
    const right = run(openClue(), { type: "mark", teamId: "a", verdict: "correct" });
    const shown = run(openClue(), { type: "reveal", revealed: true });
    const closed = run(openClue(), { type: "close" });
    const over = run(openClue(), { type: "end" });
    for (const game of [right, shown, closed, over]) {
      expect(roundCommand(game, round(), 5)).toEqual({ t: "end" });
      expect(roundCommand(game, null, 5)).toBeNull();
    }
  });

  it("replaces a round left over from another clue", () => {
    expect(roundCommand(openClue(), round({ key: "0:0" }), 5)).toMatchObject({
      t: "round",
      key: "1:2",
    });
  });
});

describe("what the phones are shown", () => {
  it("is the scores and the clue that is up, to read along on the phone", () => {
    const game = run(
      start(),
      { type: "open", key: cellKey(0, 0) },
      { type: "mark", teamId: "a", verdict: "correct" },
      { type: "close" },
      { type: "open", key: cellKey(1, 2) },
    );
    expect(boardSnapshot(game, sampleBoard)).toEqual({
      title: "Sample board",
      scores: { a: 100, b: 0 },
      clue: { category: "Around the world", value: 300, text: "The capital of Australia." },
      ended: false,
    });
  });

  it("never includes an answer, or any clue but the open one", () => {
    const open = run(start(), { type: "open", key: cellKey(1, 2) });
    const revealed = run(open, { type: "reveal", revealed: true });
    for (const game of [open, revealed]) {
      const sent = JSON.stringify(boardSnapshot(game, sampleBoard));
      // Its own answer, and a neighbouring clue with that clue's answer.
      expect(sent).not.toContain("Canberra");
      expect(sent).not.toContain("Danube");
      expect(sent).not.toContain("Vatican");
    }
  });

  it("shows no clue between clues or after the game", () => {
    expect(boardSnapshot(start(), sampleBoard).clue).toBeNull();
    expect(boardSnapshot(run(openClue(), { type: "end" }), sampleBoard)).toMatchObject({
      clue: null,
      ended: true,
    });
  });
});
