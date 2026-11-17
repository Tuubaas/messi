import { Schema } from "effect";
import { LIMITS } from "#/game/board";
import { MAX_TEAMS, TEAM_COLORS } from "#/game/game";
import { MAX_NAME_LENGTH, type Room, type RoomView } from "./room";

/**
 * What travels over a room's WebSocket. Messages from browsers are checked here before the
 * room acts on them. Browser code imports only the types, so it doesn't download the schemas.
 */

const text = (maxLength: number) => Schema.String.check(Schema.isMaxLength(maxLength));
const Id = Schema.String.check(Schema.isBetweenLength(1, 64));
/** A moment in room time as estimated by the sender, or `null` if its clock isn't in step yet. */
const Moment = Schema.NullOr(Schema.Finite);

const Team = Schema.Struct({
  id: Id,
  name: text(LIMITS.category),
  color: Schema.Literals(TEAM_COLORS),
});

const Board = Schema.Struct({
  title: text(LIMITS.title),
  scores: Schema.Record(Schema.String, Schema.Finite),
  clue: Schema.NullOr(
    Schema.Struct({
      category: text(LIMITS.category),
      value: Schema.Finite,
      text: text(LIMITS.clue),
    }),
  ),
  ended: Schema.Boolean,
});

/** Clock sync: `c` is the sender's clock, `rtt` its best measured round trip so far. */
const Sync = Schema.Struct({ t: Schema.Literal("sync"), c: Schema.Finite, rtt: Moment });

const fromPlayer = Schema.Union([
  Sync,
  Schema.Struct({ t: Schema.Literal("join"), name: text(MAX_NAME_LENGTH), teamId: Id }),
  Schema.Struct({ t: Schema.Literal("leave") }),
  Schema.Struct({ t: Schema.Literal("buzz"), at: Moment }),
]);

const fromHost = Schema.Union([
  Sync,
  Schema.Struct({
    t: Schema.Literal("setup"),
    teams: Schema.Array(Team).check(Schema.isBetweenLength(1, MAX_TEAMS)),
    manual: Schema.Boolean,
  }),
  Schema.Struct({ t: Schema.Literal("board"), board: Board }),
  Schema.Struct({
    t: Schema.Literal("round"),
    key: Id,
    eligible: Schema.Array(Id).check(Schema.isMaxLength(MAX_TEAMS)),
    clear: Schema.Boolean,
    at: Moment,
  }),
  Schema.Struct({ t: Schema.Literal("arm"), at: Moment }),
  Schema.Struct({ t: Schema.Literal("end") }),
  Schema.Struct({ t: Schema.Literal("kick"), playerId: Id }),
  /** The game is over for good: the room and everything in it is deleted. */
  Schema.Struct({ t: Schema.Literal("close") }),
]);

export type PlayerMessage = typeof fromPlayer.Type;
export type HostMessage = typeof fromHost.Type;

export const decodePlayerMessage = Schema.decodeUnknownOption(Schema.fromJsonString(fromPlayer));
export const decodeHostMessage = Schema.decodeUnknownOption(Schema.fromJsonString(fromHost));

export type ServerMessage =
  /** Answer to a `sync`: `c` echoed back, `s` the room's clock. */
  | { readonly t: "sync"; readonly c: number; readonly s: number }
  | { readonly t: "state"; readonly view: RoomView }
  /** You pressed too early; your team can't buzz until `until` (room time). */
  | { readonly t: "early"; readonly until: number };

/** What the room remembers about a connection, attached to its socket. */
export const Attachment = Schema.Union([
  Schema.Struct({ role: Schema.Literal("host") }),
  Schema.Struct({ role: Schema.Literal("player"), playerId: Id, rtt: Moment }),
]);
export type Attachment = typeof Attachment.Type;
export const decodeAttachment = Schema.decodeUnknownOption(Attachment);

const Winner = Schema.Struct({ teamId: Id, playerId: Id, name: Schema.String });

/** A room as kept in the Durable Object's storage. Anything that no longer fits is dropped. */
const StoredRoom = Schema.Struct({
  hostKey: Id,
  manual: Schema.Boolean,
  teams: Schema.Array(Team),
  players: Schema.Record(Schema.String, Schema.Struct({ id: Id, name: Schema.String, teamId: Id })),
  board: Schema.NullOr(Board),
  round: Schema.NullOr(
    Schema.Struct({
      key: Id,
      phase: Schema.Literals(["locked", "open", "answering"]),
      eligible: Schema.Array(Id),
      openAt: Moment,
      winner: Schema.NullOr(Winner),
    }),
  ),
});

export const decodeStoredRoom: (stored: unknown) => Room | null = (stored) => {
  const room = Schema.decodeUnknownOption(StoredRoom)(stored);
  return room._tag === "Some" ? room.value : null;
};
