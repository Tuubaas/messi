import { useEffect, useMemo } from "react";
import { boardSnapshot, roundCommand, wantedRound } from "#/buzzer/host";
import type { HostMessage } from "#/buzzer/messages";
import { randomRoomCode, type RoomView, type Round } from "#/buzzer/room";
import { type RoomStatus, roomUrl } from "#/buzzer/socket";
import { useRoom } from "#/buzzer/useRoom";
import type { Game, GameAction } from "#/game/game";
import type { Board } from "#/game/schema";
import { playBuzz } from "./sound";

export interface Buzzers {
  readonly code: string;
  readonly manual: boolean;
  readonly status: RoomStatus;
  readonly view: RoomView | null;
  /** The buzzing for the clue that is open right now, if the room has caught up with it. */
  readonly round: Round | null;
  /** Opens the buzzers (when the host does that by hand). */
  readonly arm: () => void;
  /** Waves the current buzz off: everyone still in may buzz again. */
  readonly clear: () => void;
  readonly kick: (playerId: string) => void;
  /** Ends the room for good. */
  readonly close: () => void;
}

/**
 * Runs the buzzer room for a game from the host's browser. The game stays here, in this
 * browser; the room is only told what it needs to know: the teams, what the phones may
 * show, and when a clue is up for buzzing. `null` for a game without buzzers.
 */
export function useBuzzers(
  game: Game,
  board: Board,
  dispatch: (action: GameAction) => void,
): Buzzers | null {
  const config = game.buzzers;
  const code = config?.code;
  const hostKey = config?.hostKey;
  const manual = config?.manual ?? false;
  const url = useMemo(
    () => (code === undefined || hostKey === undefined ? null : roomUrl(code, { host: hostKey })),
    [code, hostKey],
  );
  const { socket, status, view } = useRoom<HostMessage>(url);
  const online = status === "online";

  // Everything below is told again after every reconnect: the room may have missed it.
  useEffect(() => {
    if (online) socket?.send({ t: "setup", teams: game.teams, manual });
  }, [online, socket, game.teams, manual]);

  const snapshot = useMemo(() => boardSnapshot(game, board), [game, board]);
  useEffect(() => {
    if (online) socket?.send({ t: "board", board: snapshot });
  }, [online, socket, snapshot]);

  useEffect(() => {
    if (!online || socket === null || view === null) return;
    const command = roundCommand(game, view.round, socket.roomTime());
    if (command !== null) socket.send(command);
  }, [online, socket, game, view]);

  // A new clue is about to be buzzed on: have this screen's clock as exact as it gets.
  const openKey = game.open?.key;
  useEffect(() => {
    if (openKey !== undefined) socket?.resync();
  }, [socket, openKey]);

  // Another game got to this code first. Take a new one; the players haven't seen it yet.
  useEffect(() => {
    if (status === "taken") dispatch({ type: "moveRoom", code: randomRoomCode() });
  }, [status, dispatch]);

  const round = view?.round != null && view.round.key === openKey ? view.round : null;
  const buzzedBy = round?.winner?.playerId;
  useEffect(() => {
    if (buzzedBy !== undefined) playBuzz();
  }, [buzzedBy]);

  return useMemo(() => {
    if (code === undefined || socket === null) return null;
    return {
      code,
      manual,
      status,
      view,
      round,
      arm: () => void socket.send({ t: "arm", at: socket.roomTime() }),
      clear: () => {
        const wanted = wantedRound(game);
        if (wanted !== null) {
          socket.send({ t: "round", ...wanted, clear: true, at: socket.roomTime() });
        }
      },
      kick: (playerId) => void socket.send({ t: "kick", playerId }),
      close: () => void socket.send({ t: "close" }),
    };
  }, [code, manual, socket, status, view, round, game]);
}
