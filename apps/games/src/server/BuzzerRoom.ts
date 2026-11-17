import { DurableObject } from "cloudflare:workers";
import { Option } from "effect";
import {
  type Attachment,
  decodeAttachment,
  decodeHostMessage,
  decodePlayerMessage,
  decodeStoredRoom,
  type ServerMessage,
} from "#/buzzer/messages";
import {
  CLOSE,
  type Connection,
  decisionDeadline,
  latencyBudget,
  newRoom,
  NO_LIVE,
  type RoomEvent,
  type RoomState,
  step,
  viewOf,
} from "#/buzzer/room";

/** A room where no clue has come up for this long is deleted. */
const ROOM_LIFETIME_MS = 12 * 60 * 60 * 1000;
const KEY_PATTERN = /^[\w-]{8,64}$/;

/**
 * One game's buzzer room, as a Durable Object: every screen in the game holds a WebSocket
 * to it. The rules are in `buzzer/room.ts`; this class only connects them to sockets,
 * storage and the clock.
 *
 * It uses hibernating WebSockets, so a room with nothing going on costs nothing, however
 * long phones stay connected.
 */
export class BuzzerRoom extends DurableObject<Env> {
  /** `null` until a host claims this code. */
  private state: RoomState | null = null;
  private decision: ReturnType<typeof setTimeout> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alives are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    void ctx.blockConcurrencyWhile(async () => {
      const room = decodeStoredRoom(await ctx.storage.get("room"));
      this.state = room === null ? null : { room, live: NO_LIVE };
    });
  }

  override fetch(request: Request): Response {
    const url = new URL(request.url);
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket.", { status: 426 });
    }
    // Only this site's own pages may open a room socket.
    const origin = request.headers.get("origin");
    if (origin !== null && URL.parse(origin)?.host !== url.host) {
      return new Response("Cross-site connections are not allowed.", { status: 403 });
    }
    const hostKey = url.searchParams.get("host");
    const playerId = url.searchParams.get("player");
    if (hostKey !== null && KEY_PATTERN.test(hostKey)) return this.connectHost(hostKey);
    if (playerId !== null && KEY_PATTERN.test(playerId)) return this.connectPlayer(playerId);
    return new Response("Say who you are: ?host= or ?player=", { status: 400 });
  }

  private connectHost(hostKey: string): Response {
    // The first host to arrive claims the code; after that only the same key gets in.
    this.state ??= { room: newRoom(hostKey), live: NO_LIVE };
    if (this.state.room.hostKey !== hostKey) return refuse(CLOSE.taken, "This code is in use.");
    void this.ctx.storage.put("room", this.state.room);
    void this.ctx.storage.setAlarm(Date.now() + ROOM_LIFETIME_MS);
    return this.accept({ role: "host" });
  }

  private connectPlayer(playerId: string): Response {
    if (this.state === null) return refuse(CLOSE.notFound, "No game with this code.");
    const response = this.accept({ role: "player", playerId, rtt: null });
    this.broadcast();
    return response;
  }

  private accept(attachment: Attachment): Response {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    if (this.state !== null) {
      send(server, { t: "state", view: viewOf(this.state.room, this.online()) });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    // Captured first: this is when the message arrived, which is what fairness is measured from.
    const now = Date.now();
    const who = Option.getOrNull(decodeAttachment(socket.deserializeAttachment()));
    if (typeof message !== "string" || who === null || this.state === null) return;

    if (who.role === "host") {
      const received = Option.getOrNull(decodeHostMessage(message));
      if (received === null) return;
      switch (received.t) {
        case "sync":
          return send(socket, { t: "sync", c: received.c, s: now });
        case "close":
          return this.destroy();
        case "kick":
          this.closePlayer(received.playerId, CLOSE.kicked, "Removed by the host.");
          return this.apply({ type: "kick", playerId: received.playerId }, now);
        case "setup":
          return this.apply({ type: "setup", teams: received.teams, manual: received.manual }, now);
        case "board":
          return this.apply({ type: "board", board: received.board }, now);
        case "round":
          // A game that is being played is not idle: push its expiry out again.
          void this.ctx.storage.setAlarm(now + ROOM_LIFETIME_MS);
          return this.apply({ ...received, type: "round" }, now);
        case "arm":
          return this.apply({ type: "arm", at: received.at }, now);
        case "end":
          return this.apply({ type: "end" }, now);
      }
    }

    const received = Option.getOrNull(decodePlayerMessage(message));
    if (received === null) return;
    const { playerId } = who;
    switch (received.t) {
      case "sync":
        // The phone's own latency measurement decides how long the room will wait for it.
        socket.serializeAttachment({ ...who, rtt: received.rtt } satisfies Attachment);
        return send(socket, { t: "sync", c: received.c, s: now });
      case "join":
        return this.apply(
          { type: "join", playerId, name: received.name, teamId: received.teamId },
          now,
        );
      case "leave":
        return this.apply({ type: "leave", playerId }, now);
      case "buzz":
        return this.apply(
          { type: "buzz", playerId, at: received.at, budget: latencyBudget(who.rtt) },
          now,
        );
    }
  }

  override webSocketClose(socket: WebSocket, code: number) {
    // Finish the closing handshake; a socket that is already gone is fine.
    try {
      socket.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      // Already closed.
    }
    this.broadcast(socket);
    this.schedule();
  }

  override webSocketError(socket: WebSocket) {
    this.broadcast(socket);
    this.schedule();
  }

  /** The room has been idle for its whole lifetime. */
  override alarm() {
    this.destroy();
  }

  private apply(event: RoomEvent, now: number) {
    if (this.state === null) return;
    const before = this.state.room;
    const outcome = step(this.state, event, now, this.online());
    this.state = outcome.state;
    for (const { playerId, until } of outcome.early) {
      for (const socket of this.socketsOf(playerId)) send(socket, { t: "early", until });
    }
    if (outcome.state.room !== before) {
      void this.ctx.storage.put("room", outcome.state.room);
      this.broadcast();
    }
    this.schedule();
  }

  /** Wakes the room when the wait for slower phones is over, to name the winner. */
  private schedule() {
    clearTimeout(this.decision);
    if (this.state === null) return;
    const deadline = decisionDeadline(this.state, this.online());
    if (deadline === null) return;
    this.decision = setTimeout(
      () => this.apply({ type: "settle" }, Date.now()),
      Math.max(0, deadline - Date.now()),
    );
  }

  private attachments(except?: WebSocket) {
    return this.ctx
      .getWebSockets()
      .filter((socket) => socket !== except && socket.readyState === WebSocket.OPEN)
      .map((socket) => ({
        socket,
        who: Option.getOrNull(decodeAttachment(socket.deserializeAttachment())),
      }));
  }

  /** The phones connected right now, each with how long its messages may take. */
  private online(except?: WebSocket): ReadonlyArray<Connection> {
    return this.attachments(except).flatMap(({ who }) =>
      who?.role === "player" ? [{ playerId: who.playerId, budget: latencyBudget(who.rtt) }] : [],
    );
  }

  private socketsOf(playerId: string) {
    return this.attachments().flatMap(({ socket, who }) =>
      who?.role === "player" && who.playerId === playerId ? [socket] : [],
    );
  }

  private closePlayer(playerId: string, code: number, reason: string) {
    for (const socket of this.socketsOf(playerId)) socket.close(code, reason);
  }

  private broadcast(except?: WebSocket) {
    if (this.state === null) return;
    const message: ServerMessage = {
      t: "state",
      view: viewOf(this.state.room, this.online(except)),
    };
    for (const { socket } of this.attachments(except)) send(socket, message);
  }

  private destroy() {
    clearTimeout(this.decision);
    this.state = null;
    for (const socket of this.ctx.getWebSockets()) socket.close(CLOSE.ended, "The game has ended.");
    void this.ctx.storage.deleteAlarm();
    void this.ctx.storage.deleteAll();
  }
}

const send = (socket: WebSocket, message: ServerMessage) => {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // The socket closed in the meantime; its close event tidies up.
  }
};

/**
 * Turns a connection down in a way the browser can read: a failed upgrade tells a page
 * nothing, so the socket is opened and closed again with a code saying why.
 */
const refuse = (code: number, reason: string): Response => {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
};
