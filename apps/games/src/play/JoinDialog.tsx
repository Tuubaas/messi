import { Button, IconButton } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Dialog } from "#/ui/Dialog";
import { Icon } from "#/ui/Icon";
import { QrCode } from "#/ui/QrCode";
import { TeamToken } from "./TeamToken";
import type { Buzzers } from "./useBuzzers";

/** How to get into the game from a phone, and who is in already. Doubles as the lobby. */
export function JoinDialog({
  open,
  buzzers,
  started,
  onClose,
}: {
  readonly open: boolean;
  readonly buzzers: Buzzers;
  /** Whether the game is under way, which changes what the button says. */
  readonly started: boolean;
  readonly onClose: () => void;
}) {
  const address = `${window.location.host}/join`;
  const link = `${window.location.origin}/join/${buzzers.code}`;
  const teams = buzzers.view?.teams ?? [];
  const players = buzzers.view?.players ?? [];

  return (
    <Dialog open={open} onClose={onClose} title="Join the game" width="46rem">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Phones as buzzers</p>
          <h2 className="semi-condensed mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Grab your phone
          </h2>
        </div>
        <IconButton icon="close" label="Close" className="-mr-2 -mt-1" onClick={onClose} />
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
        <QrCode
          value={link}
          label={`QR code to join game ${buzzers.code}`}
          className="mx-auto size-44 sm:size-52"
        />
        <div className="text-center sm:text-left">
          <p className="text-lg text-ink-300">
            Scan the code, or go to{" "}
            <span className="font-extrabold whitespace-nowrap text-cream">{address}</span> and type
          </p>
          <p
            aria-label={`Game code ${buzzers.code.split("").join(" ")}`}
            className="brass-text mt-2 text-7xl font-extrabold leading-none tracking-[0.12em] sm:text-8xl"
          >
            {buzzers.code}
          </p>
          {buzzers.status === "online" ? null : (
            <p role="status" className="mt-3 text-sm font-semibold text-bad">
              Connecting to the buzzer room…
            </p>
          )}
        </div>
      </div>

      <ul className="mt-7 grid gap-2 sm:grid-cols-2">
        {teams.map((team) => {
          const members = players.filter((player) => player.teamId === team.id);
          return (
            <li
              key={team.id}
              className={cx(
                `team-${team.color}`,
                "flex min-h-16 items-center gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--team)_9%,var(--color-ink-900))] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--team)_28%,transparent)]",
              )}
            >
              <TeamToken team={team} className="h-9 text-base" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{team.name}</p>
                {members.length === 0 ? (
                  <p className="text-sm text-ink-400">Nobody yet</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {members.map((player) => (
                      <li
                        key={player.id}
                        className={cx(
                          "flex animate-pop items-center gap-1 rounded-full bg-white/8 py-0.5 pl-2.5 pr-1 text-sm font-semibold",
                          !player.online && "opacity-50",
                        )}
                      >
                        {player.name}
                        <button
                          type="button"
                          aria-label={`Remove ${player.name}`}
                          title={`Remove ${player.name}`}
                          onClick={() => buzzers.kick(player.id)}
                          className="grid size-5 place-items-center rounded-full text-xs text-ink-300 transition hover:bg-bad/25 hover:text-bad"
                        >
                          <Icon name="close" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-ink-400">
          {buzzers.manual
            ? "Buzzers stay locked until you open them for each clue."
            : "Buzzers open as soon as a clue is on screen."}{" "}
          Latecomers can join any time.
        </p>
        <Button variant="primary" size="lg" onClick={onClose}>
          {started ? "Back to the game" : "Everyone's in"}
        </Button>
      </div>
    </Dialog>
  );
}
