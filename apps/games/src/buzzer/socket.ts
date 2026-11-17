import { addSample, bestSample, type ClockSample, sampleOf } from "./clock";
import type { ServerMessage } from "./messages";
import { CLOSE, type RoomView } from "./room";

/**
 * - `connecting`: on its way, or on its way back after a dropped connection
 * - `online`: connected
 * - the rest are final: the room said no, and trying again won't help
 */
export type RoomStatus = "connecting" | "online" | "not-found" | "taken" | "ended" | "kicked";

export interface RoomSnapshot {
  readonly status: RoomStatus;
  /** The room as last heard. Kept while reconnecting, so screens don't blank out. */
  readonly view: RoomView | null;
  /** Whether this screen's clock is in step with the room's yet. */
  readonly synced: boolean;
  /** Room time until which this player's team is locked out for pressing early. */
  readonly lockedUntil: number;
}

export const NOT_CONNECTED: RoomSnapshot = {
  status: "connecting",
  view: null,
  synced: false,
  lockedUntil: 0,
};

const FINAL: Readonly<Record<number, RoomStatus>> = {
  [CLOSE.notFound]: "not-found",
  [CLOSE.taken]: "taken",
  [CLOSE.ended]: "ended",
  [CLOSE.kicked]: "kicked",
};

/** A handful of quick exchanges: the quickest one sets the clock. */
const SYNC_BURST_MS = [0, 100, 250, 450, 700];
const KEEP_ALIVE_MS = 25_000;
const RETRY_MS = [300, 600, 1200, 2500, 5000];

const isServerMessage = (value: unknown): value is ServerMessage =>
  typeof value === "object" &&
  value !== null &&
  "t" in value &&
  (value.t === "sync" || value.t === "state" || value.t === "early");

export const roomUrl = (
  code: string,
  who: { readonly host: string } | { readonly player: string },
) => {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams(who).toString();
  return `${scheme}//${window.location.host}/rooms/${code}/socket?${query}`;
};

/**
 * One screen's connection to its buzzer room. It reconnects by itself, keeps the local
 * clock in step with the room's, and exposes the room's state for React to subscribe to.
 */
export class RoomSocket<Outgoing extends { readonly t: string }> {
  private socket: WebSocket | null = null;
  private snapshot = NOT_CONNECTED;
  private samples: ReadonlyArray<ClockSample> = [];
  private readonly listeners = new Set<() => void>();
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private keepAlive: ReturnType<typeof setInterval> | undefined;
  private attempts = 0;
  private running = false;

  constructor(private readonly url: string) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  start() {
    if (this.running) return;
    this.running = true;
    this.connect();
    document.addEventListener("visibilitychange", this.onVisible);
    window.addEventListener("online", this.onVisible);
  }

  stop() {
    this.running = false;
    document.removeEventListener("visibilitychange", this.onVisible);
    window.removeEventListener("online", this.onVisible);
    this.clearTimers();
    this.socket?.close(1000);
    this.socket = null;
  }

  /** Sends if connected. Returns whether it went out. */
  send(message: Outgoing) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  /**
   * The room's clock for a local `performance.now()` reading (default: now). `null` until
   * the first sync answer is in.
   */
  roomTime(local: number = performance.now()) {
    const best = bestSample(this.samples);
    return best === null ? null : local + best.offset;
  }

  /** Measures the clock again. Cheap enough to do whenever precision is about to matter. */
  resync() {
    for (const delay of SYNC_BURST_MS) this.later(delay, () => this.ping());
  }

  private ping() {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const rtt = bestSample(this.samples)?.roundTrip ?? null;
    this.socket.send(JSON.stringify({ t: "sync", c: performance.now(), rtt }));
  }

  private connect() {
    if (!this.running) return;
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.attempts = 0;
      this.update({ status: "online" });
      this.resync();
      this.keepAlive = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send("ping");
      }, KEEP_ALIVE_MS);
    });

    socket.addEventListener("message", (event) => {
      const received = performance.now();
      if (typeof event.data !== "string" || event.data === "pong") return;
      const message = parse(event.data);
      if (message === null) return;
      switch (message.t) {
        case "sync":
          this.samples = addSample(this.samples, sampleOf(message.c, received, message.s));
          if (!this.snapshot.synced) this.update({ synced: true });
          return;
        case "state":
          return this.update({ view: message.view });
        case "early":
          return this.update({ lockedUntil: message.until });
      }
    });

    socket.addEventListener("close", (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      clearInterval(this.keepAlive);
      const final = FINAL[event.code];
      if (final !== undefined) {
        this.running = false;
        return this.update({ status: final });
      }
      if (!this.running) return;
      this.update({ status: "connecting" });
      const delay = RETRY_MS[Math.min(this.attempts, RETRY_MS.length - 1)] ?? 5000;
      this.attempts += 1;
      this.later(delay, () => this.connect());
    });
  }

  /** Back in view or back online: reconnect at once, or re-measure the clock. */
  private readonly onVisible = () => {
    if (!this.running || document.visibilityState !== "visible") return;
    if (this.socket === null) {
      this.clearTimers();
      this.attempts = 0;
      this.connect();
    } else {
      this.resync();
    }
  };

  private later(delay: number, run: () => void) {
    this.timers.push(setTimeout(run, delay));
  }

  private clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    clearInterval(this.keepAlive);
  }

  private update(change: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }
}

const parse = (data: string): ServerMessage | null => {
  try {
    const value: unknown = JSON.parse(data);
    return isServerMessage(value) ? value : null;
  } catch {
    return null;
  }
};
