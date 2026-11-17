import { useCallback, useEffect, useState } from "react";
import {
  type BuzzerConfig,
  type Game,
  type GameAction,
  newGame,
  play,
  type Team,
} from "#/game/game";
import type { Board } from "#/game/schema";
import { loadGame, storeGame } from "./storage";

/** The game on this board in this browser: restored on load, saved on every change. */
export function useGame(board: Board) {
  const [game, setGame] = useState<Game | null>(() => loadGame(board.id));

  useEffect(() => storeGame(board.id, game), [board.id, game]);

  const dispatch = useCallback(
    (action: GameAction) =>
      setGame((current) => (current === null ? null : play(current, action, board))),
    [board],
  );

  const start = useCallback(
    (teams: ReadonlyArray<Team>, rules: { penalty: boolean; buzzers: BuzzerConfig | null }) =>
      setGame(newGame({ boardId: board.id, teams, ...rules })),
    [board.id],
  );

  /** Throws the game away and goes back to choosing teams. */
  const abandon = useCallback(() => setGame(null), []);

  return { game, dispatch, start, abandon };
}
