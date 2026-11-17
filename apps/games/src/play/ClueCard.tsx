import { useEffect, useRef } from "react";
import type { RoundPhase } from "#/buzzer/room";
import type { Team, Verdict } from "#/game/game";
import type { Clue } from "#/game/schema";
import { Button } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Icon } from "#/ui/Icon";
import { Kbd } from "#/ui/Kbd";
import { TeamToken } from "./TeamToken";

/** Long clues get smaller type, so every clue fills the card without spilling out of it. */
const clueSize = (length: number) => {
  if (length <= 60) return "text-[clamp(1.75rem,min(5.4vw,9vh),6rem)]";
  if (length <= 130) return "text-[clamp(1.5rem,min(4.2vw,7vh),4.75rem)]";
  if (length <= 240) return "text-[clamp(1.25rem,min(3.3vw,5.5vh),3.5rem)]";
  return "text-[clamp(1.1rem,min(2.6vw,4.4vh),2.75rem)]";
};

/** The buzzing on this clue, for a game played with phones. */
export interface ClueBuzz {
  /** `null` while the room hasn't caught up with this clue, e.g. during a reconnect. */
  readonly phase: RoundPhase | null;
  /** The team that buzzed first and is answering now. */
  readonly answering: { readonly team: Team; readonly player: string } | null;
  readonly onArm: () => void;
  readonly onClear: () => void;
  readonly onVerdict: (verdict: Verdict) => void;
}

function BuzzerStatus({ phase }: { readonly phase: RoundPhase | null }) {
  if (phase === "answering") return null;
  const open = phase === "open";
  return (
    <p
      role="status"
      className={cx(
        "flex flex-none items-center gap-2 rounded-full px-3.5 py-1.5 text-[clamp(0.7rem,1.1vw,1rem)] font-extrabold uppercase tracking-wider ring-1 ring-inset transition duration-100",
        open
          ? "bg-brass-400 text-ink-950 ring-brass-300"
          : "bg-black/25 text-ink-300 ring-white/12",
      )}
    >
      {open ? (
        <span className="relative flex size-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-ink-950/60" />
          <span className="relative size-2.5 rounded-full bg-ink-950" />
        </span>
      ) : (
        <Icon name={phase === "locked" ? "lock" : "phone"} />
      )}
      {open ? "Buzzers open" : phase === "locked" ? "Buzzers locked" : "Connecting buzzers…"}
    </p>
  );
}

/** A clue, opened over the board for the whole room to read. */
export function ClueCard({
  category,
  value,
  clue,
  revealed,
  touched,
  buzz,
  onReveal,
  onClose,
  onPutBack,
}: {
  readonly category: string;
  readonly value: number;
  readonly clue: Clue;
  readonly revealed: boolean;
  /** Whether anything has happened to this clue yet: answer shown or a team judged. */
  readonly touched: boolean;
  /** `null` when there is nothing to buzz for: no phones, or the answer is up. */
  readonly buzz: ClueBuzz | null;
  readonly onReveal: (revealed: boolean) => void;
  readonly onClose: () => void;
  readonly onPutBack: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const answering = buzz?.answering ?? null;

  // Keys go to the card, not to the tile underneath that opened it.
  useEffect(() => card.current?.focus({ preventScroll: true }), []);

  return (
    <section
      ref={card}
      tabIndex={-1}
      aria-label={`${category}, ${value} points`}
      // The card's edge is the signal players watch: it lights up the instant buzzers open.
      data-buzzers={buzz?.phase ?? undefined}
      className={cx(
        "clue-card absolute inset-(--pad) z-10 flex flex-col overflow-hidden rounded-[clamp(14px,2vw,32px)] outline-none",
        answering !== null && `team-${answering.team.color}`,
      )}
    >
      <header className="flex items-center justify-between gap-4 px-[clamp(16px,3.5vw,56px)] pt-[clamp(14px,3vh,40px)]">
        <p className="semi-condensed min-w-0 flex-1 truncate text-[clamp(0.8rem,1.7vw,1.6rem)] font-extrabold uppercase tracking-wide text-ink-200">
          {category}
        </p>
        {buzz === null ? null : <BuzzerStatus phase={buzz.phase} />}
        <p className="brass-text condensed flex-1 text-right text-[clamp(1.25rem,3vw,3rem)] font-extrabold leading-none tabular-nums">
          {value}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-[clamp(16px,6vw,120px)] py-4 text-center">
        <div className="my-auto flex w-full flex-col items-center gap-[clamp(16px,4.5vh,56px)]">
          <p
            className={cx(
              "animate-rise font-bold leading-[1.12] tracking-tight text-balance whitespace-pre-line [animation-delay:120ms]",
              clueSize(clue.clue.length),
            )}
          >
            {clue.clue}
          </p>
          {revealed ? (
            <div className="flex animate-rise flex-col items-center gap-2">
              <p className="eyebrow">Answer</p>
              <p className="brass-text text-[clamp(1.5rem,min(4vw,7vh),4.5rem)] font-extrabold leading-[1.1] tracking-tight text-balance whitespace-pre-line">
                {clue.answer.trim() === "" ? "—" : clue.answer}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {answering === null || buzz === null ? null : (
        <div
          role="status"
          className="mx-[clamp(12px,2.5vw,40px)] mb-[clamp(8px,1.6vh,20px)] flex animate-pop flex-wrap items-center gap-x-[clamp(10px,1.4vw,22px)] gap-y-2 rounded-[clamp(14px,1.6vw,26px)] bg-[color-mix(in_oklab,var(--team)_30%,var(--color-ink-900))] p-[clamp(10px,1.2vw,18px)] shadow-[inset_0_0_0_2px_var(--team),0_0_60px_-10px_var(--team)]"
        >
          <TeamToken
            team={answering.team}
            className="h-[clamp(2.75rem,4.4vw,4.5rem)] text-[clamp(1.25rem,2vw,2.25rem)]"
          />
          <div className="min-w-0 flex-1 text-left">
            <p className="semi-condensed truncate text-[clamp(1.4rem,2.8vw,3rem)] font-extrabold leading-none tracking-tight">
              {answering.team.name}
            </p>
            <p className="mt-1 truncate text-[clamp(0.8rem,1.2vw,1.2rem)] font-semibold text-ink-200">
              {answering.player === "" ? "Buzzed in" : `${answering.player} buzzed in`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={buzz.onClear} title="Ignore this buzz">
            Wave off
          </Button>
          <Button variant="wrong" size="lg" onClick={() => buzz.onVerdict("wrong")}>
            <Icon name="close" />
            Wrong
            <Kbd>N</Kbd>
          </Button>
          <Button variant="right" size="lg" onClick={() => buzz.onVerdict("correct")}>
            <Icon name="check" />
            Right
            <Kbd>Y</Kbd>
          </Button>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 px-[clamp(12px,2.5vw,40px)] pb-[clamp(12px,2.5vh,32px)]">
        <div className="flex-1">
          {touched ? (
            <Button variant="ghost" size="sm" onClick={onPutBack} title="Undo this clue">
              <Icon name="undo" />
              Put back
            </Button>
          ) : null}
        </div>
        {buzz?.phase === "locked" ? (
          <Button variant="primary" onClick={buzz.onArm}>
            <Icon name="bell" />
            Open buzzers
            <Kbd>B</Kbd>
          </Button>
        ) : null}
        <Button onClick={() => onReveal(!revealed)}>
          {revealed ? "Hide answer" : "Show answer"}
          <Kbd>Space</Kbd>
        </Button>
        <div className="flex flex-1 justify-end">
          <Button variant={buzz?.phase === "locked" ? "secondary" : "primary"} onClick={onClose}>
            {touched ? "Done" : "Close"}
            <Kbd>Esc</Kbd>
          </Button>
        </div>
      </footer>
    </section>
  );
}
