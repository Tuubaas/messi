import type { TeamColor } from "#/game/game";

/**
 * A buzzer room: the phones connected to one game, and who buzzed first.
 *
 * Pure state and transitions. The Durable Object in `server/BuzzerRoom.ts` feeds it
 * messages and the time; nothing here touches the network, so the fairness rules can be
 * tested exactly.
 *
 * Fairness, in short: a buzz counts from when the button was pressed, not from when the
 * message arrived. Every phone keeps its clock in step with the room's and sends the press
 * time with its buzz. The room then waits just long enough that no earlier press can still
 * be on its way before it names the winner.
 */

/** Room codes are read off a TV and typed on a phone: four letters, none that look alike. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z]{4}$/;

/** Why the room closed a connection, as WebSocket close codes. */
export const CLOSE = {
  /** No game is running under this code. */
  notFound: 4404,
  /** The code belongs to someone else's game. */
  taken: 4403,
  /** The host ended the game, or it was left idle until it expired. */
  ended: 4410,
  /** The host removed this player. */
  kicked: 4401,
} as const;

export const MAX_PLAYERS = 60;
export const MAX_NAME_LENGTH = 24;

/** How long an early press locks a team out, when the host opens the buzzers by hand. */
export const EARLY_PENALTY_MS = 250;

/** The longest a message is ever believed to have been on its way. */
const MAX_BUDGET_MS = 400;
const MIN_BUDGET_MS = 40;
/** Added to a phone's measured round trip, to cover a message that was slower than usual. */
const JITTER_MARGIN_MS = 25;
/** Assumed round trip for a phone that hasn't measured its own yet. */
const UNKNOWN_ROUND_TRIP_MS = 150;
/** Presses made while the buzzers are locked are kept this long, in case "open" is on its way. */
const EARLY_MEMORY_MS = 1000;

export interface RoomTeam {
  readonly id: string;
  readonly name: string;
  readonly color: TeamColor;
}

export interface RoomPlayer {
  readonly id: string;
  readonly name: string;
  readonly teamId: string;
}

/** What the phones show about the game. The host's browser owns the game and sends this. */
export interface BoardSnapshot {
  readonly title: string;
  readonly scores: Readonly<Record<string, number>>;
  /**
   * The clue that is on the big screen right now, for players who would rather read it on
   * their phone. Only ever this one clue, and never its answer.
   */
  readonly clue: {
    readonly category: string;
    readonly value: number;
    readonly text: string;
  } | null;
  readonly ended: boolean;
}

/**
 * - `locked`: a clue is up but the host hasn't opened the buzzers yet (only when `manual`)
 * - `open`: press now
 * - `answering`: one team buzzed first and has the floor
 */
export type RoundPhase = "locked" | "open" | "answering";

export interface RoundWinner {
  readonly teamId: string;
  readonly playerId: string;
  readonly name: string;
}

/** The buzzing for one clue. */
export interface Round {
  /** Which clue: its cell on the board. */
  readonly key: string;
  readonly phase: RoundPhase;
  /** Teams that may still buzz: everyone who hasn't answered this clue wrong. */
  readonly eligible: ReadonlyArray<string>;
  /** When the buzzers opened, in room time. A press before this doesn't count. */
  readonly openAt: number | null;
  readonly winner: RoundWinner | null;
}

/** Everything about a room that survives the Durable Object going to sleep. */
export interface Room {
  /** Secret the host's browser holds; whoever has it runs the room. */
  readonly hostKey: string;
  /** Whether the host opens the buzzers by hand, instead of them opening with the clue. */
  readonly manual: boolean;
  readonly teams: ReadonlyArray<RoomTeam>;
  readonly players: Readonly<Record<string, RoomPlayer>>;
  readonly board: BoardSnapshot | null;
  readonly round: Round | null;
}

interface Press {
  readonly playerId: string;
  readonly teamId: string;
  /** When the button was pressed, in room time. */
  readonly at: number;
}

/** What only matters for the split second around a buzz. Lost if the room restarts; that's fine. */
export interface Live {
  /** The earliest valid press per team, waiting for the decision. In order of arrival. */
  readonly pending: ReadonlyArray<Press>;
  /** Presses made while the buzzers were locked. */
  readonly early: ReadonlyArray<Press>;
  /** Teams locked out for pressing early, and until when. */
  readonly penalties: Readonly<Record<string, number>>;
}

export interface RoomState {
  readonly room: Room;
  readonly live: Live;
}

/** A phone that is connected right now. */
export interface Connection {
  readonly playerId: string;
  /** The longest one of its messages is believed to take: see `latencyBudget`. */
  readonly budget: number;
}

export type RoomEvent =
  | { readonly type: "setup"; readonly teams: ReadonlyArray<RoomTeam>; readonly manual: boolean }
  | { readonly type: "board"; readonly board: BoardSnapshot }
  | {
      readonly type: "round";
      readonly key: string;
      readonly eligible: ReadonlyArray<string>;
      /** Throw away the current buzz and let everyone eligible buzz again. */
      readonly clear: boolean;
      readonly at: number | null;
    }
  | { readonly type: "arm"; readonly at: number | null }
  | { readonly type: "end" }
  | { readonly type: "kick"; readonly playerId: string }
  | {
      readonly type: "join";
      readonly playerId: string;
      readonly name: string;
      readonly teamId: string;
    }
  | { readonly type: "leave"; readonly playerId: string }
  | {
      readonly type: "buzz";
      readonly playerId: string;
      /** The phone's own estimate of when the button was pressed, in room time. */
      readonly at: number | null;
      readonly budget: number;
    }
  /** The wait for slower phones is over. */
  | { readonly type: "settle" };

export interface Outcome {
  readonly state: RoomState;
  /** Players to tell that they pressed too early, and until when their team is locked out. */
  readonly early: ReadonlyArray<{ readonly playerId: string; readonly until: number }>;
}

export const NO_LIVE: Live = { pending: [], early: [], penalties: {} };

export const newRoom = (hostKey: string): Room => ({
  hostKey,
  manual: false,
  teams: [],
  players: {},
  board: null,
  round: null,
});

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** Whether two small pieces of room data say the same thing. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The longest a phone's message is believed to take to arrive, from the round trip the
 * phone measured. It bounds both how far back a press is trusted and how long the room
 * waits for that phone before deciding.
 */
export const latencyBudget = (roundTripMs: number | null) =>
  clamp(
    Math.round(
      (roundTripMs !== null && Number.isFinite(roundTripMs) ? roundTripMs : UNKNOWN_ROUND_TRIP_MS) +
        JITTER_MARGIN_MS,
    ),
    MIN_BUDGET_MS,
    MAX_BUDGET_MS,
  );

/**
 * When something happened, in room time: the sender's own estimate, but never later than
 * the message arrived and never further back than its connection could explain. The second
 * bound is what stops a tampered phone from claiming it pressed long ago.
 */
const happenedAt = (claimed: number | null, arrival: number, budget: number) =>
  claimed === null || !Number.isFinite(claimed)
    ? arrival
    : clamp(claimed, arrival - budget, arrival);

const earliest = (presses: ReadonlyArray<Press>) =>
  // Strictly earlier wins, so of two presses in the same millisecond the first to arrive stays.
  presses.reduce((first, next) => (next.at < first.at ? next : first));

/**
 * When the winner can be named: once every phone that hasn't been heard from could no
 * longer deliver a press earlier than the earliest one so far. `null` if nobody has buzzed.
 */
export const decisionDeadline = (
  { room, live }: RoomState,
  online: ReadonlyArray<Connection>,
): number | null => {
  const round = room.round;
  if (round === null || round.phase !== "open" || live.pending.length === 0) return null;
  const waitFor = online
    .filter(({ playerId }) => {
      const teamId = room.players[playerId]?.teamId;
      return (
        teamId !== undefined &&
        round.eligible.includes(teamId) &&
        !live.pending.some((press) => press.teamId === teamId)
      );
    })
    .map((connection) => connection.budget);
  return earliest(live.pending).at + Math.max(0, ...waitFor);
};

const settle = (state: RoomState, now: number, online: ReadonlyArray<Connection>): RoomState => {
  const deadline = decisionDeadline(state, online);
  const round = state.room.round;
  if (deadline === null || round === null || now < deadline) return state;
  const first = earliest(state.live.pending);
  return {
    room: {
      ...state.room,
      round: {
        ...round,
        phase: "answering",
        winner: {
          teamId: first.teamId,
          playerId: first.playerId,
          name: state.room.players[first.playerId]?.name ?? "",
        },
      },
    },
    live: { ...state.live, pending: [] },
  };
};

/** Records a valid press: a team is represented by its earliest one. */
const withPending = (pending: ReadonlyArray<Press>, press: Press): ReadonlyArray<Press> => {
  const current = pending.find((other) => other.teamId === press.teamId);
  if (current === undefined) return [...pending, press];
  return press.at < current.at
    ? pending.map((other) => (other === current ? press : other))
    : pending;
};

const withPenalty = (
  penalties: Live["penalties"],
  press: Press,
): { readonly penalties: Live["penalties"]; readonly until: number } => {
  const until = Math.max(penalties[press.teamId] ?? 0, press.at + EARLY_PENALTY_MS);
  return { penalties: { ...penalties, [press.teamId]: until }, until };
};

const buzz = (
  state: RoomState,
  event: Extract<RoomEvent, { type: "buzz" }>,
  now: number,
  online: ReadonlyArray<Connection>,
): Outcome => {
  const { room, live } = state;
  const round = room.round;
  const player = room.players[event.playerId];
  if (round === null || player === undefined || !round.eligible.includes(player.teamId)) {
    return { state, early: [] };
  }
  const press: Press = {
    playerId: player.id,
    teamId: player.teamId,
    at: happenedAt(event.at, now, event.budget),
  };

  if (round.phase === "locked") {
    // Too early, unless the host's "open" turns out to be on its way: `arm` re-checks these.
    const { penalties, until } = withPenalty(live.penalties, press);
    const early = [...live.early.filter((other) => other.at > now - EARLY_MEMORY_MS), press];
    return {
      state: { room, live: { ...live, early, penalties } },
      early: [{ playerId: player.id, until }],
    };
  }

  if (round.phase !== "open" || round.openAt === null) return { state, early: [] };

  if (press.at < round.openAt) {
    // Pressed before the buzzers opened. Only a foul when the host opens them by hand.
    if (!room.manual) return { state, early: [] };
    const { penalties, until } = withPenalty(live.penalties, press);
    return {
      state: { room, live: { ...live, penalties } },
      early: [{ playerId: player.id, until }],
    };
  }

  const lockedUntil = live.penalties[press.teamId] ?? 0;
  if (press.at < lockedUntil) {
    return { state, early: [{ playerId: player.id, until: lockedUntil }] };
  }

  const pending = withPending(live.pending, press);
  return { state: settle({ room, live: { ...live, pending } }, now, online), early: [] };
};

/** Opens the buzzers and sorts the presses made around that moment into fouls and buzzes. */
const arm = (
  state: RoomState,
  openAt: number,
  now: number,
  online: ReadonlyArray<Connection>,
): RoomState => {
  const round = state.room.round;
  if (round === null || round.phase !== "locked") return state;
  let penalties: Live["penalties"] = {};
  for (const press of state.live.early) {
    if (press.at < openAt) penalties = withPenalty(penalties, press).penalties;
  }
  let pending: ReadonlyArray<Press> = [];
  for (const press of state.live.early) {
    if (press.at >= openAt && press.at >= (penalties[press.teamId] ?? 0)) {
      pending = withPending(pending, press);
    }
  }
  return settle(
    {
      room: { ...state.room, round: { ...round, phase: "open", openAt } },
      live: { pending, early: [], penalties },
    },
    now,
    online,
  );
};

const startRound = (
  state: RoomState,
  event: Extract<RoomEvent, { type: "round" }>,
  now: number,
): RoomState => {
  const { room, live } = state;
  const at = happenedAt(event.at, now, MAX_BUDGET_MS);
  const current = room.round;

  if (current === null || current.key !== event.key) {
    const round: Round = {
      key: event.key,
      phase: room.manual ? "locked" : "open",
      eligible: event.eligible,
      openAt: room.manual ? null : at,
      winner: null,
    };
    return { room: { ...room, round }, live: NO_LIVE };
  }

  const winnerStands =
    !event.clear && current.winner !== null && event.eligible.includes(current.winner.teamId);
  if (current.phase === "answering" && !winnerStands) {
    // The answer was wrong or waved off: everyone still eligible may buzz again, from now.
    const round: Round = {
      ...current,
      phase: "open",
      eligible: event.eligible,
      openAt: at,
      winner: null,
    };
    return { room: { ...room, round }, live: { ...live, pending: [], early: [] } };
  }

  return {
    room: { ...room, round: { ...current, eligible: event.eligible } },
    live: {
      ...live,
      pending: live.pending.filter((press) => event.eligible.includes(press.teamId)),
    },
  };
};

const withoutPlayer = (room: Room, playerId: string): Room => ({
  ...room,
  players: Object.fromEntries(Object.entries(room.players).filter(([id]) => id !== playerId)),
});

/** Applies one event. `now` is the room's clock; `online` is who is connected at this moment. */
export const step = (
  state: RoomState,
  event: RoomEvent,
  now: number,
  online: ReadonlyArray<Connection>,
): Outcome => {
  const { room, live } = state;
  const next = (changed: RoomState): Outcome => ({ state: changed, early: [] });

  switch (event.type) {
    case "setup": {
      // The host repeats itself after every reconnect; only a real change is worth telling.
      if (event.manual === room.manual && same(event.teams, room.teams)) return next(state);
      const teamIds = new Set(event.teams.map((team) => team.id));
      const players = Object.fromEntries(
        Object.entries(room.players).filter(([, player]) => teamIds.has(player.teamId)),
      );
      return next({ room: { ...room, teams: event.teams, manual: event.manual, players }, live });
    }
    case "board":
      return next(
        same(event.board, room.board) ? state : { room: { ...room, board: event.board }, live },
      );
    case "round":
      return next(settle(startRound(state, event, now), now, online));
    case "arm":
      return next(arm(state, happenedAt(event.at, now, MAX_BUDGET_MS), now, online));
    case "end":
      return next(room.round === null ? state : { room: { ...room, round: null }, live: NO_LIVE });
    case "join": {
      const known = room.players[event.playerId] !== undefined;
      const full = Object.keys(room.players).length >= MAX_PLAYERS;
      if (!room.teams.some((team) => team.id === event.teamId) || (!known && full))
        return next(state);
      const name = event.name.trim().slice(0, MAX_NAME_LENGTH);
      const player = {
        id: event.playerId,
        name: name === "" ? "Player" : name,
        teamId: event.teamId,
      };
      return next({ room: { ...room, players: { ...room.players, [player.id]: player } }, live });
    }
    case "leave":
    case "kick":
      return next({
        room: withoutPlayer(room, event.playerId),
        live: {
          ...live,
          pending: live.pending.filter((press) => press.playerId !== event.playerId),
        },
      });
    case "buzz":
      return buzz(state, event, now, online);
    case "settle":
      return next(settle(state, now, online));
  }
};

/** What every connected screen is sent: the room, without the host's secret. */
export interface RoomView {
  readonly manual: boolean;
  readonly teams: ReadonlyArray<RoomTeam>;
  readonly players: ReadonlyArray<RoomPlayer & { readonly online: boolean }>;
  readonly board: BoardSnapshot | null;
  readonly round: Round | null;
}

export const viewOf = (room: Room, online: ReadonlyArray<Connection>): RoomView => ({
  manual: room.manual,
  teams: room.teams,
  players: Object.values(room.players).map((player) => ({
    ...player,
    online: online.some((connection) => connection.playerId === player.id),
  })),
  board: room.board,
  round: room.round,
});

export const randomRoomCode = (random: () => number = Math.random) =>
  Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)] ?? "A",
  ).join("");
