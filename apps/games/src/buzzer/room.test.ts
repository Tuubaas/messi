import { describe, expect, it } from "vite-plus/test";
import {
  type Connection,
  decisionDeadline,
  EARLY_PENALTY_MS,
  latencyBudget,
  newRoom,
  NO_LIVE,
  randomRoomCode,
  ROOM_CODE_PATTERN,
  type RoomEvent,
  type RoomState,
  step,
  viewOf,
} from "./room";

const teams = [
  { id: "a", name: "Ants", color: "coral" },
  { id: "b", name: "Bees", color: "sky" },
  { id: "c", name: "Cats", color: "lime" },
] as const;

/** Three phones on a home network, one per team. Every message may take up to 50 ms. */
const online: ReadonlyArray<Connection> = [
  { playerId: "anna", budget: 50 },
  { playerId: "bo", budget: 50 },
  { playerId: "cleo", budget: 50 },
];

type Timed = readonly [now: number, event: RoomEvent];

const run = (
  state: RoomState,
  events: ReadonlyArray<Timed>,
  connections: ReadonlyArray<Connection> = online,
) => events.reduce((current, [now, event]) => step(current, event, now, connections).state, state);

const lobby = (manual = false) =>
  run({ room: newRoom("host-key"), live: NO_LIVE }, [
    [0, { type: "setup", teams, manual }],
    [0, { type: "join", playerId: "anna", name: "Anna", teamId: "a" }],
    [0, { type: "join", playerId: "bo", name: "Bo", teamId: "b" }],
    [0, { type: "join", playerId: "cleo", name: " Cleo ", teamId: "c" }],
  ]);

const everyone = ["a", "b", "c"];
const openRound = (at: number): Timed => [
  at,
  { type: "round", key: "0:0", eligible: everyone, clear: false, at },
];
const press = (now: number, playerId: string, at: number | null, budget = 50): Timed => [
  now,
  { type: "buzz", playerId, at, budget },
];
const settle = (now: number): Timed => [now, { type: "settle" }];

describe("who buzzed first", () => {
  it("goes by when the button was pressed, not by whose message arrived first", () => {
    // Anna pressed at 1000 but her message took 40 ms; Bo pressed at 1020 and it took 5 ms.
    const state = run(lobby(), [
      openRound(500),
      press(1025, "bo", 1020),
      press(1040, "anna", 1000),
      settle(1060),
    ]);
    expect(state.room.round).toMatchObject({
      phase: "answering",
      winner: { teamId: "a", playerId: "anna", name: "Anna" },
    });
  });

  it("waits for slower phones before naming a winner, and only as long as needed", () => {
    const afterFirst = run(lobby(), [openRound(500), press(1005, "bo", 1000)]);
    expect(afterFirst.room.round?.phase).toBe("open");
    // An earlier press from Anna or Cleo must arrive within their 50 ms budget.
    expect(decisionDeadline(afterFirst, online)).toBe(1050);
    expect(run(afterFirst, [settle(1049)]).room.round?.phase).toBe("open");
    expect(run(afterFirst, [settle(1050)]).room.round?.winner?.teamId).toBe("b");
  });

  it("waits longer when someone is on a slow connection, and not at all when everyone has buzzed", () => {
    const slow = [...online.slice(0, 2), { playerId: "cleo", budget: 300 }];
    const afterFirst = run(lobby(), [openRound(500), press(1005, "bo", 1000)], slow);
    expect(decisionDeadline(afterFirst, slow)).toBe(1300);

    const all = run(afterFirst, [press(1010, "anna", 1004), press(1012, "cleo", 1003, 300)], slow);
    expect(all.room.round?.winner?.teamId).toBe("b");
  });

  it("doesn't wait for phones that are offline or out of this clue", () => {
    const onlyBo = online.filter((connection) => connection.playerId === "bo");
    const state = run(lobby(), [openRound(500), press(1005, "bo", 1000)], onlyBo);
    expect(state.room.round?.winner?.teamId).toBe("b");

    const others = run(lobby(), [
      [500, { type: "round", key: "0:0", eligible: ["b"], clear: false, at: 500 }],
      press(1005, "bo", 1000),
    ]);
    expect(others.room.round?.winner?.teamId).toBe("b");
  });

  it("never believes a press was longer ago than the phone's connection can explain", () => {
    // Bo claims to have pressed 5 seconds ago; with a 50 ms budget that becomes 50 ms.
    const state = run(lobby(), [
      openRound(500),
      press(1000, "anna", 990),
      press(1010, "bo", -4000),
      settle(1100),
    ]);
    expect(state.room.round?.winner?.teamId).toBe("b");
    // ...which a cheat can stretch no further than the cap on any budget.
    expect(latencyBudget(10_000)).toBe(400);

    const honest = run(lobby(), [
      openRound(500),
      press(1000, "anna", 950),
      press(1010, "bo", -4000),
      settle(1100),
    ]);
    expect(honest.room.round?.winner?.teamId).toBe("a");
  });

  it("never believes a press from the future, and falls back to arrival without a clock", () => {
    const state = run(lobby(), [
      openRound(500),
      press(1000, "anna", null),
      press(1002, "bo", 9_999_999),
      settle(1100),
    ]);
    expect(state.room.round?.winner?.teamId).toBe("a");
  });

  it("lets a team's fastest member speak for it", () => {
    const withDan = run(lobby(), [
      [0, { type: "join", playerId: "dan", name: "Dan", teamId: "a" }],
    ]);
    const state = run(withDan, [
      openRound(500),
      press(1010, "anna", 1005),
      press(1012, "dan", 1001),
      press(1013, "bo", 1003),
      settle(1100),
    ]);
    expect(state.room.round?.winner).toEqual({ teamId: "a", playerId: "dan", name: "Dan" });
  });

  it("ignores presses from before the buzzers opened, once someone is answering, and from strangers", () => {
    const before = run(lobby(), [openRound(1000), press(1010, "bo", 990), settle(1100)]);
    expect(before.room.round?.phase).toBe("open");

    const answering = run(lobby(), [openRound(500), press(1000, "bo", 1000), settle(1050)]);
    const late = run(answering, [press(1060, "anna", 1055), settle(1200)]);
    expect(late.room.round?.winner?.teamId).toBe("b");

    const stranger = run(lobby(), [openRound(500), press(1000, "nobody", 1000), settle(1100)]);
    expect(stranger.room.round?.phase).toBe("open");
  });
});

describe("after a buzz", () => {
  const answering = () => run(lobby(), [openRound(500), press(1000, "bo", 1000), settle(1050)]);

  it("reopens for the others when the answer was wrong, from that moment", () => {
    const reopened = run(answering(), [
      [3000, { type: "round", key: "0:0", eligible: ["a", "c"], clear: false, at: 3000 }],
    ]);
    expect(reopened.room.round).toMatchObject({ phase: "open", winner: null, openAt: 3000 });

    // Bo is out; a press Anna made before the reopening doesn't count either.
    const state = run(reopened, [
      press(3010, "bo", 3005),
      press(3012, "anna", 2990),
      press(3020, "cleo", 3015),
      settle(3100),
    ]);
    expect(state.room.round?.winner?.teamId).toBe("c");
  });

  it("can wave a buzz off and let everyone try again", () => {
    const cleared = run(answering(), [
      [3000, { type: "round", key: "0:0", eligible: everyone, clear: true, at: 3000 }],
    ]);
    expect(cleared.room.round).toMatchObject({ phase: "open", winner: null });
  });

  it("keeps the winner when the host only repeats the round", () => {
    const repeated = run(answering(), [
      [3000, { type: "round", key: "0:0", eligible: everyone, clear: false, at: 3000 }],
    ]);
    expect(repeated.room.round?.winner?.teamId).toBe("b");
  });

  it("starts clean on the next clue and closes when the host ends the round", () => {
    const next = run(answering(), [
      [5000, { type: "round", key: "1:0", eligible: everyone, clear: false, at: 5000 }],
    ]);
    expect(next.room.round).toMatchObject({ key: "1:0", phase: "open", winner: null });
    expect(run(next, [[6000, { type: "end" }]]).room.round).toBeNull();
  });
});

describe("when the host opens the buzzers by hand", () => {
  const locked = () =>
    run(lobby(true), [
      [500, { type: "round", key: "0:0", eligible: everyone, clear: false, at: 500 }],
    ]);
  const arm = (now: number, at: number): Timed => [now, { type: "arm", at }];

  it("keeps the buzzers locked until then", () => {
    expect(locked().room.round).toMatchObject({ phase: "locked", openAt: null });
    expect(run(locked(), [arm(2000, 2000)]).room.round).toMatchObject({
      phase: "open",
      openAt: 2000,
    });
  });

  it("locks out a team that presses too early, and tells the player", () => {
    const outcome = step(
      locked(),
      { type: "buzz", playerId: "bo", at: 1900, budget: 50 },
      1905,
      online,
    );
    expect(outcome.early).toEqual([{ playerId: "bo", until: 1900 + EARLY_PENALTY_MS }]);

    // Bo jumped the gun at 1900, so his press at 2100 is still inside the lockout.
    const state = run(outcome.state, [
      arm(2000, 2000),
      press(2105, "bo", 2100),
      press(2125, "anna", 2120),
      settle(2300),
    ]);
    expect(state.room.round?.winner?.teamId).toBe("a");
  });

  it("lets a team buzz again once its lockout has passed", () => {
    const state = run(locked(), [
      press(1905, "bo", 1900),
      arm(2000, 2000),
      press(2160, "bo", 2155),
      settle(2300),
    ]);
    expect(state.room.round?.winner?.teamId).toBe("b");
  });

  it("counts a press made after the host's signal even if it overtook the signal on the way", () => {
    // The host pressed "open" at 2000 but the message arrived at 2060. Bo reacted at 2030.
    const state = run(locked(), [press(2035, "bo", 2030), arm(2060, 2000), settle(2200)]);
    expect(state.room.round?.winner?.teamId).toBe("b");
  });

  it("goes straight back to open after a wrong answer, without locking again", () => {
    const state = run(locked(), [
      arm(2000, 2000),
      press(2105, "bo", 2100),
      settle(2200),
      [4000, { type: "round", key: "0:0", eligible: ["a", "c"], clear: false, at: 4000 }],
    ]);
    expect(state.room.round).toMatchObject({ phase: "open", openAt: 4000 });
  });
});

describe("the room", () => {
  it("lists players by team with who is connected, and never the host's key", () => {
    const view = viewOf(lobby().room, online.slice(0, 2));
    expect(view.players).toEqual([
      { id: "anna", name: "Anna", teamId: "a", online: true },
      { id: "bo", name: "Bo", teamId: "b", online: true },
      { id: "cleo", name: "Cleo", teamId: "c", online: false },
    ]);
    expect(JSON.stringify(view)).not.toContain("host-key");
  });

  it("lets a player switch team or leave, and refuses a team that doesn't exist", () => {
    const state = run(lobby(), [
      [0, { type: "join", playerId: "anna", name: "Anna", teamId: "b" }],
      [0, { type: "join", playerId: "eve", name: "Eve", teamId: "zzz" }],
      [0, { type: "leave", playerId: "cleo" }],
      [0, { type: "kick", playerId: "bo" }],
    ]);
    expect(Object.values(state.room.players)).toEqual([{ id: "anna", name: "Anna", teamId: "b" }]);
  });

  it("drops players whose team the host removed", () => {
    const state = run(lobby(), [[0, { type: "setup", teams: teams.slice(0, 2), manual: false }]]);
    expect(Object.keys(state.room.players)).toEqual(["anna", "bo"]);
  });

  it("budgets for latency between a floor and a cap", () => {
    expect(latencyBudget(4)).toBe(40);
    expect(latencyBudget(60)).toBe(85);
    expect(latencyBudget(null)).toBe(175);
    expect(latencyBudget(Number.NaN)).toBe(175);
  });

  it("makes codes that are easy to read out", () => {
    expect(randomRoomCode()).toMatch(ROOM_CODE_PATTERN);
    expect(randomRoomCode(() => 0)).toBe("AAAA");
    expect(randomRoomCode(() => 0.999)).toBe("ZZZZ");
  });
});
