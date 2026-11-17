import { Link } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { PlayerMessage } from "#/buzzer/messages";
import { type Mood, moodOf, openingOf } from "#/buzzer/player";
import { MAX_NAME_LENGTH, type RoomPlayer, type RoomTeam, type RoomView } from "#/buzzer/room";
import { type RoomSocket, type RoomStatus, roomUrl } from "#/buzzer/socket";
import { useRoom } from "#/buzzer/useRoom";
import { teamInitial, TeamToken } from "#/play/TeamToken";
import { buttonClass } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Icon } from "#/ui/Icon";
import { Logo } from "#/ui/Logo";
import { Notice, PagePending } from "#/ui/RouteStates";
import { loadIdentity, rememberName } from "./identity";

const anotherCode = (
  <Link to="/join" className={buttonClass({ variant: "primary" })}>
    Enter another code
  </Link>
);

/** A player's phone in a game: first choosing a team, then the buzzer. */
export function PlayerPage({ code }: { readonly code: string }) {
  const [identity, setIdentity] = useState(loadIdentity);
  const url = useMemo(() => roomUrl(code, { player: identity.id }), [code, identity.id]);
  const { socket, status, view, synced, lockedUntil } = useRoom<PlayerMessage>(url);

  if (status === "not-found") {
    return (
      <Notice title={`No game called ${code}`} actions={anotherCode}>
        Check the letters on the big screen. A game only exists once its host has started it.
      </Notice>
    );
  }
  if (status === "ended") {
    return (
      <Notice title="That's the game" actions={anotherCode}>
        The host has ended it. Thanks for playing!
      </Notice>
    );
  }
  if (status === "kicked") {
    return (
      <Notice title="You've been removed" actions={anotherCode}>
        The host took you out of this game.
      </Notice>
    );
  }
  if (socket === null || view === null) return <PagePending />;

  const me = view.players.find((player) => player.id === identity.id);
  if (me === undefined) {
    return (
      <JoinForm
        code={code}
        view={view}
        online={status === "online"}
        name={identity.name}
        onJoin={(name, teamId) => {
          setIdentity(rememberName(identity, name));
          socket.send({ t: "join", name, teamId });
        }}
      />
    );
  }

  return (
    <Buzzer
      code={code}
      view={view}
      me={me}
      socket={socket}
      status={status}
      synced={synced}
      lockedUntil={lockedUntil}
    />
  );
}

function JoinForm({
  code,
  view,
  online,
  name: savedName,
  onJoin,
}: {
  readonly code: string;
  readonly view: RoomView;
  /** Whether the connection is up right now: joining has to wait for it. */
  readonly online: boolean;
  readonly name: string;
  readonly onJoin: (name: string, teamId: string) => void;
}) {
  const [name, setName] = useState(savedName);

  return (
    <div className="stage flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <Logo className="text-lg" />
        <span className="text-sm font-bold text-ink-400">
          Game <span className="tracking-widest text-brass-300">{code}</span>
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10">
        <form className="animate-rise" onSubmit={(event: FormEvent) => event.preventDefault()}>
          <p className="eyebrow">{view.board?.title ?? "Welcome"}</p>
          <h1 className="semi-condensed mt-2 text-5xl font-extrabold leading-none tracking-tight">
            You're in.
            <br />
            Who are you?
          </h1>
          <label htmlFor="name" className="mt-7 block font-extrabold">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="done"
            placeholder="So the host knows who buzzed"
            className="field mt-2 h-14 px-4 text-xl font-bold"
          />

          <p className="mt-7 flex items-baseline justify-between gap-3 font-extrabold">
            Your team
            {online ? null : (
              <span role="status" className="text-sm font-semibold text-bad">
                Reconnecting…
              </span>
            )}
          </p>
          {view.teams.length === 0 ? (
            <p className="mt-2 text-ink-400">Waiting for the host to set up the teams…</p>
          ) : (
            <ul className="mt-2 grid gap-2.5">
              {view.teams.map((team) => {
                const members = view.players.filter((player) => player.teamId === team.id);
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      disabled={!online}
                      onClick={() => onJoin(name, team.id)}
                      className={cx(
                        `team-${team.color}`,
                        "flex w-full items-center gap-3.5 rounded-2xl bg-[color-mix(in_oklab,var(--team)_14%,var(--color-ink-850))] p-3.5 text-left shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--team)_45%,transparent)] transition duration-150 hover:bg-[color-mix(in_oklab,var(--team)_24%,var(--color-ink-850))] active:scale-[0.98] disabled:opacity-50",
                      )}
                    >
                      <TeamToken team={team} className="h-11 text-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xl font-extrabold">{team.name}</span>
                        <span className="block truncate text-sm text-ink-300">
                          {members.length === 0
                            ? "Be the first"
                            : members.map((player) => player.name).join(", ")}
                        </span>
                      </span>
                      <Icon name="arrowRight" className="flex-none text-xl text-(--team)" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </form>
      </main>
    </div>
  );
}

/** Long clues get smaller type, so most fit above the button without scrolling. */
const clueSize = (length: number) => {
  if (length <= 60) return "text-[clamp(1.3rem,min(6.2vw,3.6vh),2rem)]";
  if (length <= 130) return "text-[clamp(1.1rem,min(5.2vw,3vh),1.6rem)]";
  if (length <= 240) return "text-[clamp(1rem,min(4.5vw,2.5vh),1.35rem)]";
  return "text-[clamp(0.9rem,min(4vw,2.2vh),1.15rem)]";
};

/** What the button says, and the line under it. */
const wording = (mood: Mood): readonly [label: string, line: string] => {
  switch (mood.kind) {
    case "idle":
      return ["", "Eyes on the big screen."];
    case "wait":
      return ["Wait", "Not yet… the host will open the buzzers."];
    case "ready":
      return ["Buzz", "Press when you know it!"];
    case "sent":
      return ["", "Buzzed!"];
    case "foul":
      return ["Too early", "Locked out for a moment."];
    case "out":
      return ["Out", "Your team has had its go at this one."];
    case "you":
      return ["You!", "You're up. Say your answer!"];
    case "teammate":
      return ["", `${mood.name} buzzed for your team.`];
    case "rival":
      return [
        mood.team === undefined ? "" : teamInitial(mood.team.name),
        `${mood.team?.name ?? "Another team"} buzzed first.`,
      ];
    case "ended":
      return ["", "That's the game."];
  }
};

const connection = (status: RoomStatus, synced: boolean) => {
  if (status !== "online") return "Reconnecting…";
  return synced ? "Connected" : "Getting in sync…";
};

function Standings({ view, myTeamId }: { readonly view: RoomView; readonly myTeamId: string }) {
  const scores = view.board?.scores ?? {};
  const table = view.teams
    .map((team) => ({ team, score: scores[team.id] ?? 0 }))
    .toSorted((a, b) => b.score - a.score);
  return (
    <ol className="grid w-full max-w-sm gap-2">
      {table.map(({ team, score }, index) => (
        <li
          key={team.id}
          className={cx(
            `team-${team.color}`,
            "flex animate-rise items-center gap-3 rounded-2xl px-3.5 py-3",
            team.id === myTeamId
              ? "bg-[color-mix(in_oklab,var(--team)_24%,var(--color-ink-850))] shadow-[inset_0_0_0_2px_var(--team)]"
              : "bg-ink-850",
          )}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <TeamToken team={team} className="h-9 text-base" />
          <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{team.name}</span>
          <span className="condensed text-2xl font-extrabold tabular-nums">
            {score < 0 ? "−" : ""}
            {Math.abs(score)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Buzzer({
  code,
  view,
  me,
  socket,
  status,
  synced,
  lockedUntil,
}: {
  readonly code: string;
  readonly view: RoomView;
  readonly me: RoomPlayer;
  readonly socket: RoomSocket<PlayerMessage>;
  readonly status: RoomStatus;
  readonly synced: boolean;
  readonly lockedUntil: number;
}) {
  const team: RoomTeam | undefined = view.teams.find((candidate) => candidate.id === me.teamId);
  const [pressedIn, setPressedIn] = useState<string | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  const mood = moodOf({ view, me, roomNow: socket.roomTime(), lockedUntil, pressedIn });
  const canPress = mood.kind === "ready" || mood.kind === "wait";
  const opening = openingOf(view);

  const press = useCallback(
    (eventTime: number) => {
      if (!canPress) return;
      // The browser stamps the event when the finger landed, which is earlier and steadier
      // than whenever this code gets to run. Older browsers stamp differently; then use now.
      const now = performance.now();
      const pressed = eventTime > 0 && eventTime <= now && now - eventTime < 500 ? eventTime : now;
      if (socket.send({ t: "buzz", at: socket.roomTime(pressed) })) setPressedIn(opening);
    },
    [canPress, socket, opening],
  );

  // A lockout ends by the clock, not by a message: look again when it is over.
  const foulUntil = mood.kind === "foul" ? mood.until : null;
  useEffect(() => {
    if (foulUntil === null) return;
    const left = foulUntil - (socket.roomTime() ?? foulUntil);
    const timer = setTimeout(rerender, Math.max(0, left) + 10);
    return () => clearTimeout(timer);
  }, [foulUntil, socket]);

  // The room names a winner within half a second. If nothing came of this press (it can
  // slip through the cracks right as the buzzers reopen), make the button live again.
  const waiting = mood.kind === "sent";
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setPressedIn(null), 1200);
    return () => clearTimeout(timer);
  }, [waiting]);

  // A new clue is coming up: have the clock as exact as it gets before anyone presses.
  const clueKey = view.round?.key;
  useEffect(() => {
    if (clueKey !== undefined) socket.resync();
  }, [clueKey, socket]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
      event.preventDefault();
      press(event.timeStamp);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press]);

  // Keep the phone awake during the game, and give it a shake when it's this player's turn.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    const hold = () => {
      if (document.visibilityState !== "visible") return;
      void navigator.wakeLock
        .request("screen")
        .then((held) => {
          lock = held;
        })
        .catch(() => undefined);
    };
    hold();
    document.addEventListener("visibilitychange", hold);
    return () => {
      document.removeEventListener("visibilitychange", hold);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const isUp = mood.kind === "you";
  useEffect(() => {
    if (isUp && "vibrate" in navigator) navigator.vibrate([90, 60, 180]);
  }, [isUp]);

  const [label, line] = wording(mood);
  const rival = mood.kind === "rival" ? mood.team : undefined;
  const clue = view.board?.clue ?? null;

  return (
    <div
      className={cx(
        team !== undefined && `team-${team.color}`,
        "flex h-dvh flex-col overflow-hidden select-none transition-colors duration-200",
        isUp ? "bg-(--team) text-ink-950" : "stage",
      )}
    >
      <header className="flex flex-none items-center gap-3 px-5 pt-5">
        {team === undefined ? null : (
          <TeamToken team={team} className={cx("h-11 text-xl", isUp && "ring-3 ring-ink-950/25")} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold leading-tight">{team?.name}</p>
          <p
            className={cx(
              "truncate text-sm font-semibold",
              isUp ? "text-ink-950/70" : "text-ink-400",
            )}
          >
            {me.name}
          </p>
        </div>
        <p
          className={cx(
            "condensed text-4xl font-extrabold leading-none tabular-nums",
            !isUp && "brass-text",
          )}
        >
          {view.board?.scores[me.teamId] ?? 0}
        </p>
      </header>

      {mood.kind === "ended" ? (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[5vh] px-6">
          <h1 className="semi-condensed text-5xl font-extrabold tracking-tight">Final scores</h1>
          <Standings view={view} myTeamId={me.teamId} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col px-6 squat:flex-row squat:items-center squat:gap-6">
          {/* The clue takes whatever room is left, so the button never moves under a thumb. */}
          <section
            aria-label="Clue"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3 text-center squat:self-stretch"
          >
            {clue === null ? null : (
              <div key={`${clue.category}:${clue.value}:${clue.text}`} className="my-auto">
                <p className={cx("eyebrow", isUp && "text-ink-950/70")}>
                  {clue.category} · {clue.value}
                </p>
                <p
                  className={cx(
                    "mt-2.5 animate-rise font-bold leading-snug tracking-tight text-balance whitespace-pre-line [animation-delay:120ms]",
                    clueSize(clue.text.length),
                  )}
                >
                  {clue.text}
                </p>
              </div>
            )}
          </section>

          <div className="flex flex-none flex-col items-center gap-[2.5vh] pb-[2vh] squat:gap-2 squat:pb-0">
            <button
              type="button"
              aria-label={label === "" ? line : label}
              aria-disabled={!canPress}
              data-mood={mood.kind}
              onPointerDown={(event) => press(event.timeStamp)}
              // Its own colour normally; the colour of whoever buzzed while they answer.
              className={cx(
                "buzzer w-[min(62vw,34vh)] outline-offset-8 squat:w-[min(30vw,50vh)]",
                rival !== undefined && `team-${rival.color}`,
                isUp && "[--tone:var(--color-ink-950)] text-(--team)",
              )}
            >
              <span className="condensed px-4 text-center text-[min(12vw,6.6vh)] font-extrabold uppercase leading-none tracking-wide squat:text-[min(6vw,10vh)]">
                {label}
              </span>
            </button>
            <p
              role="status"
              className="flex min-h-14 items-center text-center text-xl font-extrabold text-balance squat:min-h-10 squat:max-w-[34vw] squat:text-base"
            >
              {line}
            </p>
          </div>
        </main>
      )}

      <footer
        className={cx(
          "flex flex-none items-center justify-between gap-3 px-5 pb-5 text-sm font-semibold",
          isUp ? "text-ink-950/70" : "text-ink-400",
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className={cx(
              "size-2 rounded-full",
              status === "online" && synced ? "bg-good" : "animate-pulse bg-bad",
            )}
          />
          {connection(status, synced)}
        </span>
        <span>
          Game <span className="tracking-widest">{code}</span>
        </span>
        <button
          type="button"
          className="rounded-full px-2 py-1 underline decoration-dotted underline-offset-4"
          onClick={() => socket.send({ t: "leave" })}
        >
          Switch team
        </button>
      </footer>
    </div>
  );
}
