import { valueAt } from "#/game/board";
import type { RoomView } from "#/buzzer/room";
import { type Game, scores, type Team, type Verdict } from "#/game/game";
import type { Board } from "#/game/schema";
import { cx } from "#/ui/cx";
import { Icon } from "#/ui/Icon";
import { useCountTo, useLastChange } from "./motion";
import { TeamToken } from "./TeamToken";

const signed = (amount: number) => `${amount > 0 ? "+" : "−"}${Math.abs(amount)}`;

function Score({ value }: { readonly value: number }) {
  const shown = useCountTo(value);
  const change = useLastChange(value);
  return (
    <p className="condensed relative w-fit text-[clamp(1.6rem,3vw,3rem)] font-extrabold leading-none tabular-nums">
      {shown < 0 ? "−" : ""}
      {Math.abs(shown)}
      {change === null ? null : (
        <span
          key={change.id}
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute bottom-[0.1em] left-full ml-[0.4em] animate-float-up text-[0.55em]",
            change.amount > 0 ? "text-good" : "text-bad",
          )}
        >
          {signed(change.amount)}
        </span>
      )}
    </p>
  );
}

function VerdictButton({
  verdict,
  active,
  label,
  onClick,
}: {
  readonly verdict: Verdict;
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  const correct = verdict === "correct";
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "grid h-[clamp(2.75rem,3.6vw,3.5rem)] min-w-[clamp(2.75rem,3.6vw,3.5rem)] flex-none place-items-center rounded-2xl text-[clamp(1.25rem,1.8vw,1.75rem)] ring-1 ring-inset transition duration-150 active:scale-90",
        active && correct && "bg-good text-ink-950 ring-good",
        active && !correct && "bg-bad text-ink-950 ring-bad",
        !active &&
          (correct
            ? "bg-white/6 text-ink-200 ring-white/12 hover:bg-good/20 hover:text-good hover:ring-good/50"
            : "bg-white/6 text-ink-200 ring-white/12 hover:bg-bad/20 hover:text-bad hover:ring-bad/50"),
      )}
    >
      <Icon name={correct ? "check" : "close"} />
    </button>
  );
}

function TeamCard({
  team,
  number,
  score,
  picking,
  judging,
  phones,
  buzzed,
  onMark,
}: {
  readonly team: Team;
  readonly number: number;
  readonly score: number;
  readonly picking: boolean;
  /** Set while a clue is open: the card grows right/wrong buttons. */
  readonly judging: { readonly verdict: Verdict | null; readonly value: number } | null;
  /** How many of the team's phones are connected; `null` in a game without buzzers. */
  readonly phones: number | null;
  /** This team buzzed first and is answering. */
  readonly buzzed: boolean;
  readonly onMark: (verdict: Verdict) => void;
}) {
  const verdict = judging?.verdict ?? null;
  return (
    <li
      className={cx(
        `team-${team.color}`,
        "relative flex min-w-[10.5rem] flex-1 flex-wrap items-center gap-[clamp(8px,1vw,16px)] rounded-[clamp(12px,1.4vw,22px)] px-[clamp(10px,1.2vw,20px)] py-[clamp(8px,1.4vh,16px)] transition duration-300",
        "bg-[color-mix(in_oklab,var(--team)_10%,var(--color-ink-850))] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--team)_30%,transparent),inset_0_1px_0_oklch(1_0_0/0.06)]",
        verdict === "correct" &&
          "bg-[color-mix(in_oklab,var(--team)_26%,var(--color-ink-850))] shadow-[inset_0_0_0_2px_var(--team),0_0_40px_-8px_var(--team)]",
        verdict === "wrong" && "opacity-55",
        buzzed &&
          verdict === null &&
          "bg-[color-mix(in_oklab,var(--team)_26%,var(--color-ink-850))] shadow-[inset_0_0_0_2px_var(--team),0_0_40px_-8px_var(--team)]",
      )}
    >
      <TeamToken
        team={team}
        className="h-[clamp(2.25rem,3.2vw,3.25rem)] text-[clamp(1rem,1.5vw,1.5rem)]"
      />
      <div className="min-w-[4.5rem] flex-1">
        <p className="flex items-center gap-2 text-[clamp(0.8rem,1.15vw,1.15rem)] font-bold text-ink-200">
          <span className="truncate">{team.name}</span>
          {phones === null ? null : (
            <span
              title={phones === 0 ? "No phone connected" : `${phones} connected`}
              className={cx(
                "flex flex-none items-center gap-0.5 text-[0.8em] tabular-nums",
                phones === 0 ? "text-ink-500" : "text-ink-300",
              )}
            >
              <Icon name="phone" />
              {phones}
            </span>
          )}
          {picking ? (
            <span className="flex-none animate-fade rounded-full bg-brass-400/15 px-2 py-0.5 text-[0.7em] font-extrabold uppercase tracking-wider text-brass-300 ring-1 ring-inset ring-brass-400/40">
              Picks
            </span>
          ) : null}
        </p>
        <Score value={score} />
      </div>
      {judging === null ? null : (
        // On a narrow card the buttons drop below the name rather than squeezing it out.
        <div className="flex flex-none animate-pop gap-1.5 max-sm:basis-full max-sm:*:flex-1">
          <VerdictButton
            verdict="wrong"
            active={verdict === "wrong"}
            label={`${team.name} got it wrong (Shift+${number})`}
            onClick={() => onMark("wrong")}
          />
          <VerdictButton
            verdict="correct"
            active={verdict === "correct"}
            label={`${team.name} got it right, +${judging.value} (${number})`}
            onClick={() => onMark("correct")}
          />
        </div>
      )}
    </li>
  );
}

/** Every team and its score. While a clue is open, this is also where the host judges answers. */
export function Scoreboard({
  board,
  game,
  room,
  onMark,
}: {
  readonly board: Board;
  readonly game: Game;
  /** The buzzer room as last heard, in a game played with phones. */
  readonly room: RoomView | null | undefined;
  readonly onMark: (teamId: string, verdict: Verdict) => void;
}) {
  const totals = scores(game, board);
  const openKey = game.open?.key;
  const result = openKey === undefined ? undefined : game.results[openKey];

  const verdictFor = (teamId: string): Verdict | null => {
    if (result?.correct === teamId) return "correct";
    return result?.wrong.includes(teamId) === true ? "wrong" : null;
  };

  return (
    <ul
      aria-label="Scores"
      className="flex flex-none gap-(--gap) overflow-x-auto px-(--pad) pb-(--pad) pt-1 [scrollbar-width:none]"
    >
      {game.teams.map((team, index) => (
        <TeamCard
          key={team.id}
          team={team}
          number={index + 1}
          score={totals[team.id] ?? 0}
          picking={openKey === undefined && game.picker === team.id && game.teams.length > 1}
          phones={
            room === undefined
              ? null
              : (room?.players.filter((player) => player.teamId === team.id && player.online)
                  .length ?? 0)
          }
          buzzed={
            openKey !== undefined &&
            room?.round?.key === openKey &&
            room.round.winner?.teamId === team.id
          }
          judging={
            openKey === undefined
              ? null
              : { verdict: verdictFor(team.id), value: valueAt(board, openKey) }
          }
          onMark={(verdict) => onMark(team.id, verdict)}
        />
      ))}
    </ul>
  );
}
