import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { type Game, scores } from "#/game/game";
import type { Board } from "#/game/schema";
import { Button, buttonClass, IconButton } from "#/ui/Button";
import { Dialog } from "#/ui/Dialog";
import { Icon } from "#/ui/Icon";
import { Kbd } from "#/ui/Kbd";
import { isSoundOn, setSoundOn } from "./sound";
import { TeamToken } from "./TeamToken";

const SHORTCUTS: ReadonlyArray<readonly [keys: string, does: string]> = [
  ["← ↑ ↓ →", "Move around the board"],
  ["Space", "Show or hide the answer"],
  ["B", "Open the buzzers"],
  ["Y / N", "The team that buzzed got it right / wrong"],
  ["1 – 6", "That team got it right"],
  ["Shift 1 – 6", "That team got it wrong"],
  ["Esc", "Back to the board"],
  ["F", "Full screen"],
  ["M", "This menu"],
];

/** Everything the host rarely needs: fixing a score, ending early, starting over. */
export function GameMenu({
  open,
  board,
  game,
  onClose,
  onShowJoin,
  onAdjust,
  onEnd,
  onRestart,
}: {
  readonly open: boolean;
  readonly board: Board;
  readonly game: Game;
  readonly onClose: () => void;
  /** Shows the join code again; absent in a game without buzzers. */
  readonly onShowJoin: (() => void) | undefined;
  readonly onAdjust: (teamId: string, delta: number) => void;
  readonly onEnd: () => void;
  readonly onRestart: () => void;
}) {
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [sound, setSound] = useState(isSoundOn);
  const totals = scores(game, board);
  // Corrections move in steps of the smallest clue, the unit every score is made of.
  const step = Math.min(...board.values.filter((value) => value > 0), 100);

  const close = () => {
    setConfirmingRestart(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="Game menu" width="30rem">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight">Game menu</h2>
        <IconButton icon="close" label="Close menu" className="-mr-2" onClick={close} />
      </div>

      {onShowJoin === undefined ? null : (
        <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-2xl bg-ink-900/60 p-2.5 pl-4 ring-1 ring-inset ring-white/8">
          <p className="min-w-0 flex-1 font-bold">
            Join code{" "}
            <span className="brass-text font-extrabold tracking-widest">{game.buzzers?.code}</span>
          </p>
          <IconButton
            icon={sound ? "soundOn" : "soundOff"}
            label={sound ? "Turn the buzz sound off" : "Turn the buzz sound on"}
            aria-pressed={sound}
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              close();
              onShowJoin();
            }}
          >
            <Icon name="phone" />
            Show how to join
          </Button>
        </div>
      )}

      <h3 className="eyebrow mt-6">Fix a score</h3>
      <ul className="mt-3 grid gap-2">
        {game.teams.map((team) => (
          <li key={team.id} className="flex items-center gap-3">
            <TeamToken team={team} className="h-9 text-base" />
            <span className="min-w-0 flex-1 truncate font-bold">{team.name}</span>
            <IconButton
              icon="minus"
              label={`Take ${step} from ${team.name}`}
              className="bg-white/6"
              onClick={() => onAdjust(team.id, -step)}
            />
            <span className="condensed w-16 text-center text-xl font-extrabold tabular-nums">
              {totals[team.id] ?? 0}
            </span>
            <IconButton
              icon="plus"
              label={`Give ${step} to ${team.name}`}
              className="bg-white/6"
              onClick={() => onAdjust(team.id, step)}
            />
          </li>
        ))}
      </ul>

      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        <Button
          onClick={() => {
            close();
            onEnd();
          }}
        >
          End game now
        </Button>
        {confirmingRestart ? (
          <Button
            variant="danger"
            onClick={() => {
              close();
              onRestart();
            }}
          >
            Yes, wipe the scores
          </Button>
        ) : (
          <Button onClick={() => setConfirmingRestart(true)}>Start over</Button>
        )}
        <Link to="/" className={buttonClass({ variant: "ghost", className: "sm:col-span-2" })}>
          Leave — the game is kept for later
        </Link>
      </div>

      <div className="hidden [@media(hover:hover)]:block">
        <h3 className="eyebrow mt-7">Keyboard</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm text-ink-300">
          {SHORTCUTS.map(([keys, does]) => (
            <div key={keys} className="contents">
              <dt>
                <Kbd>{keys}</Kbd>
              </dt>
              <dd>{does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Dialog>
  );
}
