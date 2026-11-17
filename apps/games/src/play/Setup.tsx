import { Link } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";
import { randomRoomCode } from "#/buzzer/room";
import { type BuzzerConfig, MAX_TEAMS, type Team, TEAM_COLORS, type TeamColor } from "#/game/game";
import type { Board } from "#/game/schema";
import { Button, buttonClass, IconButton } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Icon, type IconName } from "#/ui/Icon";
import { Logo } from "#/ui/Logo";
import { loadSetup, storeSetup } from "./storage";

interface Draft {
  /** Stable while editing, so inputs keep their focus when teams are removed. */
  readonly key: number;
  readonly name: string;
  readonly color: TeamColor;
}

const nextFreeColor = (drafts: ReadonlyArray<Draft>, after?: TeamColor): TeamColor => {
  const start = after === undefined ? 0 : TEAM_COLORS.indexOf(after) + 1;
  const order = [...TEAM_COLORS.slice(start), ...TEAM_COLORS.slice(0, start)];
  return order.find((color) => !drafts.some((draft) => draft.color === color)) ?? TEAM_COLORS[0];
};

const fallbackName = (index: number) => `Team ${index + 1}`;

function Choice({
  checked,
  onChoose,
  icon,
  children,
}: {
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly icon: IconName;
  readonly children: ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center font-bold transition duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brass-400",
        checked
          ? "bg-ink-600 text-cream shadow-[inset_0_1px_0_oklch(1_0_0/0.12)]"
          : "text-ink-300 hover:text-cream",
      )}
    >
      <input
        type="radio"
        name="answering"
        className="sr-only"
        checked={checked}
        onChange={onChoose}
      />
      <Icon name={icon} className={checked ? "text-brass-400" : undefined} />
      {children}
    </label>
  );
}

function Switch({
  checked,
  onChange,
  title,
  hint,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly title: string;
  readonly hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-ink-900/60 px-4 py-3.5 ring-1 ring-inset ring-white/8">
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-ink-400">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 flex-none rounded-full bg-ink-600 transition-colors duration-200 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-cream after:transition-transform after:duration-200 after:ease-out-expo peer-checked:bg-brass-500 peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brass-400"
      />
    </label>
  );
}

/** Before a game: what's on the board, who is playing, and how. */
export function Setup({
  board,
  onStart,
}: {
  readonly board: Board;
  readonly onStart: (
    teams: ReadonlyArray<Team>,
    rules: { penalty: boolean; buzzers: BuzzerConfig | null },
  ) => void;
}) {
  const [saved] = useState(loadSetup);
  const [drafts, setDrafts] = useState<ReadonlyArray<Draft>>(() =>
    saved.teams.map((team, key) => ({ key, ...team })),
  );
  const [penalty, setPenalty] = useState(saved.penalty);
  const [buzzers, setBuzzers] = useState(saved.buzzers);
  const [manual, setManual] = useState(saved.manual);

  const update = (key: number, change: Partial<Draft>) =>
    setDrafts((all) => all.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)));

  const addTeam = () =>
    setDrafts((all) => [
      ...all,
      {
        key: Math.max(-1, ...all.map((draft) => draft.key)) + 1,
        name: "",
        color: nextFreeColor(all),
      },
    ]);

  const start = (event: FormEvent) => {
    event.preventDefault();
    const teams = drafts.map((draft, index) => ({
      id: `team-${index + 1}`,
      name: draft.name.trim() === "" ? fallbackName(index) : draft.name.trim(),
      color: draft.color,
    }));
    storeSetup({
      teams: drafts.map(({ name, color }) => ({ name: name.trim(), color })),
      penalty,
      buzzers,
      manual,
    });
    onStart(teams, {
      penalty,
      // A fresh room for this game: a code for the players, and a key only this browser has.
      buzzers: buzzers ? { code: randomRoomCode(), hostKey: crypto.randomUUID(), manual } : null,
    });
  };

  const [low, high] = [Math.min(...board.values), Math.max(...board.values)];

  return (
    <div className="stage flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-3" })}>
          <Icon name="arrowLeft" />
          All boards
        </Link>
        <Logo className="text-base" />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <section className="animate-rise">
          <p className="eyebrow">Up next</p>
          <h1 className="semi-condensed mt-3 text-5xl font-extrabold leading-[0.95] tracking-tight text-balance sm:text-7xl">
            {board.title.trim() === "" ? "Untitled board" : board.title}
          </h1>
          <ol className="mt-8 grid gap-2.5 text-lg sm:text-xl">
            {board.categories.map((category, index) => (
              <li key={index} className="flex items-baseline gap-4">
                <span className="brass-text condensed w-5 flex-none text-right font-extrabold tabular-nums">
                  {index + 1}
                </span>
                <span className="font-semibold text-ink-200">
                  {category.name.trim() === "" ? `Category ${index + 1}` : category.name}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-ink-400">
            25 clues · {low}–{high} points each
          </p>
        </section>

        <form
          onSubmit={start}
          className="surface animate-rise rounded-3xl p-6 [animation-delay:80ms] sm:p-8"
        >
          <h2 className="text-2xl font-extrabold tracking-tight">Who's playing?</h2>
          <ul className="mt-5 grid gap-2.5">
            {drafts.map((draft, index) => (
              <li key={draft.key} className={cx(`team-${draft.color}`, "flex items-center gap-2")}>
                <button
                  type="button"
                  title="Change colour"
                  aria-label={`Change colour of ${draft.name.trim() || fallbackName(index)}`}
                  className="team-token size-11 text-lg transition duration-150 hover:scale-110 active:scale-95"
                  onClick={() => update(draft.key, { color: nextFreeColor(drafts, draft.color) })}
                >
                  {index + 1}
                </button>
                <input
                  className="field h-12 px-4 text-lg font-semibold"
                  aria-label={`Name of team ${index + 1}`}
                  placeholder={fallbackName(index)}
                  maxLength={24}
                  value={draft.name}
                  autoFocus={index === 0}
                  onChange={(event) => update(draft.key, { name: event.target.value })}
                />
                <IconButton
                  icon="close"
                  label={`Remove ${draft.name.trim() || fallbackName(index)}`}
                  disabled={drafts.length === 1}
                  onClick={() => setDrafts((all) => all.filter((other) => other.key !== draft.key))}
                />
              </li>
            ))}
          </ul>
          {drafts.length < MAX_TEAMS ? (
            <Button variant="ghost" size="sm" className="mt-3 -ml-1" onClick={addTeam}>
              <Icon name="plus" />
              Add a team
            </Button>
          ) : null}

          <fieldset className="mt-6">
            <legend className="eyebrow">Answering</legend>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-2xl bg-ink-900/60 p-1.5 ring-1 ring-inset ring-white/8">
              <Choice checked={buzzers} onChoose={() => setBuzzers(true)} icon="phone">
                Phones as buzzers
              </Choice>
              <Choice checked={!buzzers} onChoose={() => setBuzzers(false)} icon="bell">
                Call it out
              </Choice>
            </div>
            <p className="mt-2 px-1 text-sm text-ink-400">
              {buzzers
                ? "Everyone joins with a code on their phone. First to press gets to answer."
                : "No phones needed. You decide who was first."}
            </p>
          </fieldset>

          <div className="mt-4 grid gap-2">
            {buzzers ? (
              <Switch
                checked={manual}
                onChange={setManual}
                title="You open the buzzers"
                hint="Locked while you read the clue. Pressing too early locks a team out for a moment."
              />
            ) : null}
            <Switch
              checked={penalty}
              onChange={setPenalty}
              title="Wrong answers lose points"
              hint="A miss costs what the clue was worth."
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full">
            <Icon name="play" />
            Start game
          </Button>
        </form>
      </main>
    </div>
  );
}
