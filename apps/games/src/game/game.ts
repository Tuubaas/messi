import { CELL_KEYS, type CellKey, clueAt, isPlayable, valueAt } from "./board";
import type { BoardContent } from "./schema";

/**
 * One game being played on a board: who is playing, what has been answered, and the score.
 * Pure state and transitions, so the rules can be tested without a browser.
 */

export const TEAM_COLORS = ["coral", "sky", "lime", "pink", "teal", "violet"] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];
export const MAX_TEAMS = TEAM_COLORS.length;

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly color: TeamColor;
}

/** How a clue went: at most one team got it right, any number got it wrong. */
export interface CellResult {
  readonly correct: string | null;
  readonly wrong: ReadonlyArray<string>;
}

/** Phones as buzzers: which room they connect to, and how buzzing opens. */
export interface BuzzerConfig {
  /** The code players type to join. */
  readonly code: string;
  /** Secret that makes this browser the room's host. It never leaves this browser and the room. */
  readonly hostKey: string;
  /** Whether the host opens the buzzers by hand, instead of them opening with each clue. */
  readonly manual: boolean;
}

export interface Game {
  readonly boardId: string;
  readonly teams: ReadonlyArray<Team>;
  /** Whether a wrong answer costs the clue's points. */
  readonly penalty: boolean;
  /** `null` when teams just call out their answers and the host picks who was first. */
  readonly buzzers: BuzzerConfig | null;
  /** A cell with an entry here has been played, even if nobody scored. */
  readonly results: Readonly<Partial<Record<CellKey, CellResult>>>;
  /** Manual corrections by the host, per team. */
  readonly adjustments: Readonly<Record<string, number>>;
  /** The team that chooses the next clue: whoever answered correctly last. */
  readonly picker: string | null;
  readonly open: { readonly key: CellKey; readonly revealed: boolean } | null;
  readonly ended: boolean;
}

export type Verdict = "correct" | "wrong";

export type GameAction =
  | { readonly type: "open"; readonly key: CellKey }
  | { readonly type: "reveal"; readonly revealed: boolean }
  | { readonly type: "mark"; readonly teamId: string; readonly verdict: Verdict }
  | { readonly type: "close" }
  | { readonly type: "putBack" }
  | { readonly type: "adjust"; readonly teamId: string; readonly delta: number }
  | { readonly type: "end" }
  | { readonly type: "resume" }
  | { readonly type: "restart" }
  /** The room code turned out to be taken by another game: carry on under a new one. */
  | { readonly type: "moveRoom"; readonly code: string };

export const newGame = (input: {
  readonly boardId: string;
  readonly teams: ReadonlyArray<Team>;
  readonly penalty: boolean;
  readonly buzzers: BuzzerConfig | null;
}): Game => ({
  boardId: input.boardId,
  teams: input.teams,
  penalty: input.penalty,
  buzzers: input.buzzers,
  results: {},
  adjustments: {},
  picker: input.teams[0]?.id ?? null,
  open: null,
  ended: false,
});

const NO_RESULT: CellResult = { correct: null, wrong: [] };

const isUntouched = (result: CellResult) => result.correct === null && result.wrong.length === 0;

const without = (results: Game["results"], key: CellKey): Game["results"] =>
  Object.fromEntries(Object.entries(results).filter(([other]) => other !== key));

/** Whether anything has happened to the open clue: its answer was shown or a team was judged. */
export const isOpenClueTouched = (game: Game) =>
  game.open !== null &&
  (game.open.revealed || !isUntouched(game.results[game.open.key] ?? NO_RESULT));

export const playableKeys = (content: BoardContent): ReadonlyArray<CellKey> =>
  CELL_KEYS.filter((key) => isPlayable(clueAt(content, key)));

export const remainingKeys = (game: Game, content: BoardContent): ReadonlyArray<CellKey> =>
  playableKeys(content).filter((key) => game.results[key] === undefined);

/** Leaves the open clue. It counts as played if the answer was shown or anyone was judged. */
const closeOpen = (game: Game, content: BoardContent): Game => {
  if (game.open === null) return game;
  const { key, revealed } = game.open;
  const result = game.results[key] ?? NO_RESULT;
  const played = revealed || !isUntouched(result);
  const results = played ? { ...game.results, [key]: result } : without(game.results, key);
  const closed = { ...game, results, open: null };
  return { ...closed, ended: played && remainingKeys(closed, content).length === 0 };
};

const mark = (result: CellResult, teamId: string, verdict: Verdict): CellResult => {
  const wrong = result.wrong.filter((id) => id !== teamId);
  if (verdict === "correct") {
    return { correct: result.correct === teamId ? null : teamId, wrong };
  }
  return {
    correct: result.correct === teamId ? null : result.correct,
    wrong: result.wrong.includes(teamId) ? wrong : [...wrong, teamId],
  };
};

export const play = (game: Game, action: GameAction, content: BoardContent): Game => {
  switch (action.type) {
    case "open": {
      if (!isPlayable(clueAt(content, action.key))) return game;
      const closed = closeOpen(game, content);
      // Reopening a played clue is for corrections, so its answer is already showing.
      const revealed = closed.results[action.key] !== undefined;
      return { ...closed, ended: false, open: { key: action.key, revealed } };
    }
    case "reveal":
      return game.open === null
        ? game
        : { ...game, open: { ...game.open, revealed: action.revealed } };
    case "mark": {
      if (game.open === null || !game.teams.some((team) => team.id === action.teamId)) return game;
      const { key } = game.open;
      const result = mark(game.results[key] ?? NO_RESULT, action.teamId, action.verdict);
      const gotIt = result.correct === action.teamId;
      return {
        ...game,
        results: { ...game.results, [key]: result },
        // A correct answer ends the clue: show the answer and hand that team the next pick.
        open: gotIt ? { key, revealed: true } : game.open,
        picker: gotIt ? action.teamId : game.picker,
      };
    }
    case "close":
      return closeOpen(game, content);
    case "putBack":
      return game.open === null
        ? game
        : { ...game, results: without(game.results, game.open.key), open: null };
    case "adjust":
      return {
        ...game,
        adjustments: {
          ...game.adjustments,
          [action.teamId]: (game.adjustments[action.teamId] ?? 0) + action.delta,
        },
      };
    case "end":
      return { ...closeOpen(game, content), ended: true };
    case "resume":
      return { ...game, ended: false };
    case "restart":
      return newGame(game);
    case "moveRoom":
      return game.buzzers === null
        ? game
        : { ...game, buzzers: { ...game.buzzers, code: action.code } };
  }
};

export const scores = (game: Game, content: BoardContent): Readonly<Record<string, number>> => {
  const totals = new Map(game.teams.map((team) => [team.id, game.adjustments[team.id] ?? 0]));
  const add = (teamId: string, points: number) => {
    const total = totals.get(teamId);
    if (total !== undefined) totals.set(teamId, total + points);
  };
  for (const key of CELL_KEYS) {
    const result = game.results[key];
    if (result === undefined) continue;
    const value = valueAt(content, key);
    if (result.correct !== null) add(result.correct, value);
    if (game.penalty) for (const teamId of result.wrong) add(teamId, -value);
  }
  return Object.fromEntries(totals);
};

export interface Standing {
  readonly team: Team;
  readonly score: number;
  /** 1 for the leader; teams on the same score share a rank. */
  readonly rank: number;
}

export const standings = (game: Game, content: BoardContent): ReadonlyArray<Standing> => {
  const totals = scores(game, content);
  const ordered = game.teams
    .map((team) => ({ team, score: totals[team.id] ?? 0 }))
    .toSorted((a, b) => b.score - a.score);
  return ordered.map((entry) => ({
    ...entry,
    rank: ordered.findIndex((other) => other.score === entry.score) + 1,
  }));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isTeamColor = (value: unknown): value is TeamColor =>
  TEAM_COLORS.some((color) => color === value);

const isCellKey = (value: unknown): value is CellKey => CELL_KEYS.some((key) => key === value);

const readTeams = (value: unknown): ReadonlyArray<Team> | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TEAMS) return null;
  const teams: Array<Team> = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const { id, name, color } = item;
    if (typeof id !== "string" || typeof name !== "string" || !isTeamColor(color)) return null;
    teams.push({ id, name, color });
  }
  return teams;
};

const readResults = (value: unknown): Game["results"] | null => {
  if (!isRecord(value)) return null;
  const results: Partial<Record<CellKey, CellResult>> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isCellKey(key) || !isRecord(item)) return null;
    const { correct, wrong } = item;
    if ((correct !== null && typeof correct !== "string") || !isStringArray(wrong)) return null;
    results[key] = { correct, wrong };
  }
  return results;
};

const readAdjustments = (value: unknown): Game["adjustments"] | null => {
  if (!isRecord(value)) return null;
  const adjustments: Record<string, number> = {};
  for (const [teamId, delta] of Object.entries(value)) {
    if (typeof delta !== "number" || !Number.isFinite(delta)) return null;
    adjustments[teamId] = delta;
  }
  return adjustments;
};

const readOpen = (value: unknown): Game["open"] | undefined => {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { key, revealed } = value;
  return isCellKey(key) && typeof revealed === "boolean" ? { key, revealed } : undefined;
};

const readBuzzers = (value: unknown): BuzzerConfig | null => {
  if (!isRecord(value)) return null;
  const { code, hostKey, manual } = value;
  return typeof code === "string" && typeof hostKey === "string" && typeof manual === "boolean"
    ? { code, hostKey, manual }
    : null;
};

/**
 * Reads a game saved by an earlier visit. Anything that doesn't look like a game for this
 * board is dropped, so stale or hand-edited storage can never break the play view.
 */
export const readSavedGame = (value: unknown, boardId: string): Game | null => {
  if (!isRecord(value) || value["boardId"] !== boardId) return null;
  const teams = readTeams(value["teams"]);
  const results = readResults(value["results"]);
  const adjustments = readAdjustments(value["adjustments"]);
  const open = readOpen(value["open"]);
  const { penalty, picker, ended } = value;
  if (teams === null || results === null || adjustments === null || open === undefined) return null;
  if (typeof penalty !== "boolean" || typeof ended !== "boolean") return null;
  if (picker !== null && typeof picker !== "string") return null;
  const buzzers = readBuzzers(value["buzzers"]);
  return { boardId, teams, penalty, buzzers, results, adjustments, picker, open, ended };
};

/** The teams and rules to offer when setting up a game. */
export interface TeamSetup {
  readonly teams: ReadonlyArray<Pick<Team, "name" | "color">>;
  readonly penalty: boolean;
  /** Whether players buzz in on their phones. */
  readonly buzzers: boolean;
  /** With buzzers: whether the host opens them by hand. */
  readonly manual: boolean;
}

export const DEFAULT_SETUP: TeamSetup = {
  teams: [
    { name: "", color: TEAM_COLORS[0] },
    { name: "", color: TEAM_COLORS[1] },
  ],
  penalty: true,
  buzzers: true,
  manual: false,
};

/** Reads the setup remembered from the last game, falling back to two unnamed teams. */
export const readSavedSetup = (value: unknown): TeamSetup => {
  if (!isRecord(value) || !Array.isArray(value["teams"])) return DEFAULT_SETUP;
  const teams: Array<TeamSetup["teams"][number]> = [];
  for (const item of value["teams"].slice(0, MAX_TEAMS)) {
    if (!isRecord(item)) return DEFAULT_SETUP;
    const { name, color } = item;
    if (typeof name !== "string" || !isTeamColor(color)) return DEFAULT_SETUP;
    teams.push({ name, color });
  }
  if (teams.length === 0) return DEFAULT_SETUP;
  return {
    teams,
    penalty: value["penalty"] !== false,
    buzzers: value["buzzers"] !== false,
    manual: value["manual"] === true,
  };
};
