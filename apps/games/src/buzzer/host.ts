import { type CellKey, clueAt, parseCellKey, valueAt } from "#/game/board";
import { type Game, scores } from "#/game/game";
import type { BoardContent } from "#/game/schema";
import type { HostMessage } from "./messages";
import type { BoardSnapshot, Round } from "./room";

/**
 * How the host's browser, which owns the game, keeps the buzzer room in step with it.
 * Both functions only look at the game as it is now, so after a reload or a dropped
 * connection the room is simply told again.
 */

/**
 * What the phones get to see of the game: the scores, and the clue that is on the big
 * screen right now. Never an answer, and never a clue that hasn't been opened.
 */
export const boardSnapshot = (game: Game, board: BoardContent): BoardSnapshot => {
  const open = game.ended ? null : game.open;
  const category = open === null ? undefined : board.categories[parseCellKey(open.key).category];
  return {
    title: board.title,
    scores: scores(game, board),
    clue:
      open === null
        ? null
        : {
            category: category?.name ?? "",
            value: valueAt(board, open.key),
            text: clueAt(board, open.key).clue,
          },
    ended: game.ended,
  };
};

/** The buzzing the game calls for right now: on which clue, and which teams may still buzz. */
export const wantedRound = (
  game: Game,
): { readonly key: CellKey; readonly eligible: ReadonlyArray<string> } | null => {
  if (game.ended || game.open === null || game.open.revealed) return null;
  const result = game.results[game.open.key];
  // Someone got it: nothing left to buzz for.
  if (result !== undefined && result.correct !== null) return null;
  const wrong = result?.wrong ?? [];
  return {
    key: game.open.key,
    eligible: game.teams.filter((team) => !wrong.includes(team.id)).map((team) => team.id),
  };
};

type RoundCommand = Extract<HostMessage, { t: "round" | "end" }>;

const sameTeams = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * What to tell the room so its round matches the game, or `null` if it already does.
 * `at` is when the host acted, in room time.
 */
export const roundCommand = (
  game: Game,
  round: Round | null,
  at: number | null,
): RoundCommand | null => {
  const wanted = wantedRound(game);
  if (wanted === null) return round === null ? null : { t: "end" };
  if (round !== null && round.key === wanted.key && sameTeams(round.eligible, wanted.eligible)) {
    return null;
  }
  return { t: "round", key: wanted.key, eligible: wanted.eligible, clear: false, at };
};
