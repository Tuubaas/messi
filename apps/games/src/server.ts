import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

// Durable Object classes have to be exported from the Worker's entry module.
export { BuzzerRoom } from "./server/BuzzerRoom";

/** `/rooms/<code>/socket`: the WebSocket every screen in a game holds to its buzzer room. */
const ROOM_SOCKET = /^\/rooms\/([A-HJ-NP-Z]{4})\/socket$/;

export default createServerEntry({
  async fetch(request, options) {
    // TanStack Start has no way to hand a request to a Durable Object, and a WebSocket
    // upgrade can't pass through its response handling, so room sockets are routed here.
    const code = ROOM_SOCKET.exec(new URL(request.url).pathname)?.[1];
    if (code !== undefined) return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    return handler.fetch(request, options);
  },
});
