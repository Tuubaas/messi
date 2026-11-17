import { type Game, readSavedGame, readSavedSetup, type TeamSetup } from "#/game/game";

/**
 * Games live in this browser only: the screen everyone is looking at is the game. A reload
 * (or a closed laptop) picks up exactly where it was.
 */

const GAME_PREFIX = "tubas:game:";
const SETUP_KEY = "tubas:setup";

const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    // Storage can be blocked or hold something unreadable; both mean "nothing saved".
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Without storage the game still works, it just won't survive a reload.
  }
};

export const loadGame = (boardId: string): Game | null =>
  readSavedGame(read(GAME_PREFIX + boardId), boardId);

export const storeGame = (boardId: string, game: Game | null) => write(GAME_PREFIX + boardId, game);

/** The teams from last time, so a regular group doesn't retype their names. */
export const loadSetup = (): TeamSetup => readSavedSetup(read(SETUP_KEY));

export const storeSetup = (setup: TeamSetup) => write(SETUP_KEY, setup);
