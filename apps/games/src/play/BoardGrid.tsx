import { Fragment, type KeyboardEvent, useEffect, useRef } from "react";
import { CATEGORY_COUNT, type CellKey, cellKey, isPlayable } from "#/game/board";
import type { Game } from "#/game/game";
import type { Board } from "#/game/schema";
import { cx } from "#/ui/cx";
import { TeamToken } from "./TeamToken";

const ARROWS: Readonly<Record<string, readonly [category: number, row: number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Where a tile sits, read back from the `data-cell` it was rendered with. */
const positionOf = (target: EventTarget) => {
  const key = target instanceof HTMLElement ? target.dataset["cell"] : undefined;
  if (key === undefined) return null;
  const [category = 0, row = 0] = key.split(":").map(Number);
  return { category, row };
};

/** The 5×5 board: a column per category, a row per point value. */
export function BoardGrid({
  board,
  game,
  morphKey,
  onOpen,
}: {
  readonly board: Board;
  readonly game: Game;
  /** The tile that the clue card grows out of and shrinks back into. */
  readonly morphKey: CellKey | null;
  readonly onOpen: (key: CellKey) => void;
}) {
  const open = game.open !== null;
  const grid = useRef<HTMLDivElement>(null);

  // Arriving at the board, the keyboard starts on the first clue that can still be played.
  useEffect(() => {
    if (document.activeElement !== document.body) return;
    grid.current
      ?.querySelector<HTMLElement>('[data-state="ready"]')
      ?.focus({ preventScroll: true });
  }, []);

  /** Arrow keys walk the board, skipping the gaps left by empty clues. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROWS[event.key];
    const from = positionOf(event.target);
    if (step === undefined || from === null) return;
    event.preventDefault();
    for (let distance = 1; distance < CATEGORY_COUNT; distance++) {
      const category = from.category + step[0] * distance;
      const row = from.row + step[1] * distance;
      const tile = event.currentTarget.querySelector<HTMLButtonElement>(
        `[data-cell="${cellKey(category, row)}"]:not(:disabled)`,
      );
      if (tile !== null) {
        tile.focus();
        return;
      }
    }
  };

  return (
    <div
      ref={grid}
      inert={open}
      onKeyDown={onKeyDown}
      className="grid h-full grid-flow-col grid-cols-5 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-(--gap)"
    >
      {board.categories.map((category, categoryIndex) => {
        const name = category.name.trim() === "" ? `Category ${categoryIndex + 1}` : category.name;
        return (
          <Fragment key={categoryIndex}>
            <h2 className="semi-condensed flex min-w-0 items-center justify-center rounded-[clamp(8px,1vw,16px)] bg-ink-900/70 px-1.5 py-[clamp(8px,1.6vh,20px)] text-center text-[clamp(0.6rem,1.35vw,1.3rem)] font-extrabold uppercase leading-[1.1] tracking-wide text-balance wrap-anywhere shadow-[inset_0_-3px_0_var(--color-brass-500)]">
              {name}
            </h2>
            {category.clues.map((clue, row) => {
              const key = cellKey(categoryIndex, row);
              const value = board.values[row] ?? 0;
              const result = game.results[key];
              const winner = game.teams.find((team) => team.id === result?.correct);
              const state = !isPlayable(clue) ? "empty" : result === undefined ? "ready" : "played";
              return (
                <button
                  key={row}
                  type="button"
                  data-cell={key}
                  data-state={state}
                  disabled={state === "empty"}
                  aria-label={`${name}, ${value} points${state === "played" ? `, played${winner === undefined ? "" : `, won by ${winner.name}`}` : ""}`}
                  style={morphKey === key && !open ? { viewTransitionName: "clue" } : undefined}
                  className={cx("tile", winner !== undefined && `team-${winner.color}`)}
                  onClick={() => onOpen(key)}
                >
                  {state === "ready" ? (
                    <span className="brass-text condensed text-[clamp(1.15rem,min(4.4vw,8vh),5.5rem)] font-extrabold leading-none tabular-nums drop-shadow-[0_2px_0_oklch(0_0_0/0.4)]">
                      {value}
                    </span>
                  ) : null}
                  {state === "played" && winner !== undefined ? (
                    <TeamToken
                      team={winner}
                      className="h-[min(52%,3.75rem)] animate-pop text-[clamp(0.8rem,1.9vw,1.6rem)]"
                    />
                  ) : null}
                  {state === "played" && winner === undefined ? (
                    <span className="condensed text-[clamp(0.9rem,2.2vw,2rem)] font-extrabold tabular-nums text-ink-600 line-through decoration-2">
                      {value}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

export const focusTile = (key: CellKey) =>
  document.querySelector<HTMLElement>(`[data-cell="${key}"]`)?.focus({ preventScroll: true });
