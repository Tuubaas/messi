import { Link } from "@tanstack/react-router";
import { type Game, standings } from "#/game/game";
import type { Board } from "#/game/schema";
import { Button, buttonClass } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Icon } from "#/ui/Icon";
import { Confetti } from "./Confetti";
import { TeamToken } from "./TeamToken";

const listNames = (names: ReadonlyArray<string>) =>
  new Intl.ListFormat("en", { type: "conjunction" }).format(names);

/** The end of a game: who won, and everyone's score. */
export function Finale({
  board,
  game,
  onPlayAgain,
  onBackToBoard,
  onNewTeams,
}: {
  readonly board: Board;
  readonly game: Game;
  readonly onPlayAgain: () => void;
  readonly onBackToBoard: () => void;
  readonly onNewTeams: () => void;
}) {
  const table = standings(game, board);
  const winners = table.filter((standing) => standing.rank === 1).map(({ team }) => team);
  const solo = game.teams.length === 1;

  return (
    <div className="stage flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
      <Confetti colors={winners.map((team) => team.color)} />
      <p className="eyebrow animate-rise">Final scores · {board.title}</p>
      <h1 className="semi-condensed mt-4 animate-rise text-5xl font-extrabold leading-[0.95] tracking-tight text-balance [animation-delay:80ms] sm:text-7xl">
        {solo
          ? "That's the board!"
          : winners.length === game.teams.length
            ? "It's a tie!"
            : `${listNames(winners.map((team) => team.name))} ${winners.length === 1 ? "wins" : "win"}!`}
      </h1>

      <ol className="mt-10 grid w-full max-w-xl gap-2.5">
        {table.map(({ team, score, rank }, index) => (
          <li
            key={team.id}
            style={{ animationDelay: `${200 + index * 90}ms` }}
            className={cx(
              `team-${team.color}`,
              "flex animate-rise items-center gap-4 rounded-2xl px-4 py-3 text-left",
              rank === 1
                ? "bg-[color-mix(in_oklab,var(--team)_22%,var(--color-ink-850))] py-4 shadow-[inset_0_0_0_2px_var(--team),0_0_60px_-12px_var(--team)]"
                : "bg-ink-850 shadow-[inset_0_0_0_1px_oklch(1_0_0/0.07)]",
            )}
          >
            <span className="condensed w-6 text-center text-xl font-extrabold tabular-nums text-ink-400">
              {rank}
            </span>
            <TeamToken team={team} className={rank === 1 ? "h-12 text-xl" : "h-10 text-lg"} />
            <span
              className={cx(
                "flex min-w-0 flex-1 items-center gap-2 font-bold",
                rank === 1 ? "text-2xl" : "text-lg",
              )}
            >
              <span className="truncate">{team.name}</span>
              {rank === 1 && !solo ? (
                <Icon name="crown" className="flex-none text-brass-400" />
              ) : null}
            </span>
            <span
              className={cx(
                "condensed font-extrabold tabular-nums",
                rank === 1 ? "brass-text text-4xl" : "text-2xl",
              )}
            >
              {score < 0 ? "−" : ""}
              {Math.abs(score)}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex animate-rise flex-wrap justify-center gap-3 [animation-delay:600ms]">
        <Button variant="primary" size="lg" onClick={onPlayAgain}>
          Play again
        </Button>
        <Button size="lg" onClick={onNewTeams}>
          Change teams
        </Button>
        <Link to="/" className={buttonClass({ size: "lg" })}>
          All boards
        </Link>
      </div>
      <Button variant="ghost" size="sm" className="mt-4" onClick={onBackToBoard}>
        <Icon name="arrowLeft" />
        Back to the board to fix a score
      </Button>
    </div>
  );
}
