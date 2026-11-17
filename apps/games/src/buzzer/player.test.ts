import { describe, expect, it } from "vite-plus/test";
import { moodOf, openingOf } from "./player";
import type { RoomView, Round } from "./room";

const teams = [
  { id: "a", name: "Ants", color: "coral" },
  { id: "b", name: "Bees", color: "sky" },
] as const;

const me = { id: "anna", name: "Anna", teamId: "a" };

const view = (round: Partial<Round> | null, ended = false): RoomView => ({
  manual: false,
  teams,
  players: [{ ...me, online: true }],
  board: { title: "Board", scores: {}, clue: null, ended },
  round:
    round === null
      ? null
      : { key: "0:0", phase: "open", eligible: ["a", "b"], openAt: 100, winner: null, ...round },
});

const mood = (
  room: RoomView,
  extra: { roomNow?: number | null; lockedUntil?: number; pressedIn?: string | null } = {},
) => moodOf({ view: room, me, roomNow: 1000, lockedUntil: 0, pressedIn: null, ...extra }).kind;

describe("what a player's phone shows", () => {
  it("waits between clues and when the game is over", () => {
    expect(mood(view(null))).toBe("idle");
    expect(mood(view({}, true))).toBe("ended");
  });

  it("invites a press while the buzzers are open, and holds back while they are locked", () => {
    expect(mood(view({}))).toBe("ready");
    expect(mood(view({ phase: "locked", openAt: null }))).toBe("wait");
  });

  it("remembers a press only for the opening it was made in", () => {
    const first = view({});
    expect(mood(first, { pressedIn: openingOf(first) })).toBe("sent");
    // The buzzers reopen after a wrong answer: the button is live again.
    const reopened = view({ openAt: 5000 });
    expect(mood(reopened, { pressedIn: openingOf(first) })).toBe("ready");
  });

  it("says who has the floor", () => {
    const won = (winner: Round["winner"]) => view({ phase: "answering", winner });
    expect(mood(won({ teamId: "a", playerId: "anna", name: "Anna" }))).toBe("you");
    expect(
      moodOf({
        view: won({ teamId: "a", playerId: "dan", name: "Dan" }),
        me,
        roomNow: 1000,
        lockedUntil: 0,
        pressedIn: null,
      }),
    ).toEqual({ kind: "teammate", name: "Dan" });
    expect(
      moodOf({
        view: won({ teamId: "b", playerId: "bo", name: "Bo" }),
        me,
        roomNow: 1000,
        lockedUntil: 0,
        pressedIn: null,
      }),
    ).toEqual({ kind: "rival", team: teams[1], name: "Bo" });
  });

  it("sits a team out after its wrong answer", () => {
    expect(mood(view({ eligible: ["b"] }))).toBe("out");
  });

  it("shows a lockout for pressing early until the room's clock passes it", () => {
    const locked = view({ phase: "locked", openAt: null });
    expect(mood(locked, { lockedUntil: 1200 })).toBe("foul");
    expect(mood(locked, { lockedUntil: 1200, roomNow: 1201 })).toBe("wait");
    expect(mood(view({}), { lockedUntil: 1200, roomNow: 1201 })).toBe("ready");
  });
});
