import { useEffect, useMemo, useSyncExternalStore } from "react";
import { NOT_CONNECTED, RoomSocket } from "./socket";

const neverChanges = () => () => undefined;
const notConnected = () => NOT_CONNECTED;

/** Connects to a buzzer room for as long as the component is on screen. `null` connects to nothing. */
export function useRoom<Outgoing extends { readonly t: string }>(url: string | null) {
  const socket = useMemo(() => (url === null ? null : new RoomSocket<Outgoing>(url)), [url]);

  useEffect(() => {
    socket?.start();
    return () => socket?.stop();
  }, [socket]);

  const snapshot = useSyncExternalStore(
    socket?.subscribe ?? neverChanges,
    socket?.getSnapshot ?? notConnected,
    notConnected,
  );

  return { socket, ...snapshot };
}
