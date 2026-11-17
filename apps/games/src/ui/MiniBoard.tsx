import { CELL_KEYS } from "#/game/board";
import type { Game } from "#/game/game";
import { cx } from "./cx";

/**
 * A thumbnail of the 5×5 board. With a game in progress it shows who has won which clue,
 * in the teams' colours.
 */
export function MiniBoard({
  game,
  className,
}: {
  readonly game?: Game | null;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("grid size-16 flex-none grid-flow-col grid-rows-5 gap-[3px]", className)}
    >
      {CELL_KEYS.map((key) => {
        const result = game?.results[key];
        const winner = game?.teams.find((team) => team.id === result?.correct);
        return (
          <span
            key={key}
            className={cx(
              "rounded-[3px] transition-colors duration-500",
              winner !== undefined && `team-${winner.color} bg-(--team)`,
              winner === undefined && (result === undefined ? "bg-brass-400/35" : "bg-white/10"),
            )}
          />
        );
      })}
    </span>
  );
}
