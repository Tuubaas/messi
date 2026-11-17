import type { RoomPlayer, RoomTeam, RoomView } from "./room";

/** What a player's phone should be showing, worked out from the room and the room's clock. */
export type Mood =
  /** Nothing to buzz for: between clues, or the answer is already up. */
  | { readonly kind: "idle" }
  | { readonly kind: "ended" }
  /** A clue is up, but the host hasn't opened the buzzers yet. Pressing now is a foul. */
  | { readonly kind: "wait" }
  | { readonly kind: "ready" }
  /** Pressed; the room is still working out who was first. */
  | { readonly kind: "sent" }
  /** Pressed too early: locked out until this room time. */
  | { readonly kind: "foul"; readonly until: number }
  /** This player's team already got this clue wrong. */
  | { readonly kind: "out" }
  | { readonly kind: "you" }
  | { readonly kind: "teammate"; readonly name: string }
  | { readonly kind: "rival"; readonly team: RoomTeam | undefined; readonly name: string };

/** Identifies one opening of the buzzers, so a press is only remembered for that one. */
export const openingOf = (view: RoomView) =>
  view.round === null ? null : `${view.round.key}@${view.round.openAt ?? "locked"}`;

export const moodOf = (input: {
  readonly view: RoomView;
  readonly me: RoomPlayer;
  /** The room's clock, or `null` while this phone's clock isn't in step yet. */
  readonly roomNow: number | null;
  /** From the room's last "too early" notice. */
  readonly lockedUntil: number;
  /** The opening this phone last buzzed in, see `openingOf`. */
  readonly pressedIn: string | null;
}): Mood => {
  const { view, me, roomNow, lockedUntil, pressedIn } = input;
  if (view.board?.ended === true) return { kind: "ended" };
  const round = view.round;
  if (round === null) return { kind: "idle" };

  if (round.winner !== null) {
    if (round.winner.playerId === me.id) return { kind: "you" };
    if (round.winner.teamId === me.teamId) return { kind: "teammate", name: round.winner.name };
    return {
      kind: "rival",
      team: view.teams.find((team) => team.id === round.winner?.teamId),
      name: round.winner.name,
    };
  }

  if (!round.eligible.includes(me.teamId)) return { kind: "out" };
  if (roomNow !== null && roomNow < lockedUntil) return { kind: "foul", until: lockedUntil };
  if (round.phase === "locked") return { kind: "wait" };
  return pressedIn === openingOf(view) ? { kind: "sent" } : { kind: "ready" };
};
