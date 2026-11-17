import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { type CellKey, clueAt, parseCellKey, valueAt } from "#/game/board";
import {
  type Game,
  type GameAction,
  isOpenClueTouched,
  remainingKeys,
  type Verdict,
} from "#/game/game";
import type { Board } from "#/game/schema";
import { IconButton } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Icon } from "#/ui/Icon";
import { LogoMark } from "#/ui/Logo";
import { BoardGrid, focusTile } from "./BoardGrid";
import { type ClueBuzz, ClueCard } from "./ClueCard";
import { Finale } from "./Finale";
import { GameMenu } from "./GameMenu";
import { JoinDialog } from "./JoinDialog";
import { morph } from "./motion";
import { Scoreboard } from "./Scoreboard";
import { Setup } from "./Setup";
import { useBuzzers } from "./useBuzzers";
import { useGame } from "./useGame";

const subscribeToFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

function useFullscreen() {
  const active = useSyncExternalStore(
    subscribeToFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );
  const toggle = useCallback(() => {
    // Not every browser allows it (iPhones don't); the game is fine without.
    if (document.fullscreenElement === null) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);
  return {
    active,
    toggle,
    supported: typeof document.documentElement.requestFullscreen === "function",
  };
}

/** Typing in a field or pressing a focused button must not also trigger a game shortcut. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest("input, textarea, select, dialog") !== null;

const isControl = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest("button, a") !== null;

/** The whole play view for one board: team setup, the game itself, and the results. */
export function PlayPage({ board }: { readonly board: Board }) {
  const { game, dispatch, start, abandon } = useGame(board);
  if (game === null) return <Setup board={board} onStart={start} />;
  return <Table board={board} game={game} dispatch={dispatch} onAbandon={abandon} />;
}

/** A game in progress, from the first clue to the final scores. */
function Table({
  board,
  game,
  dispatch,
  onAbandon,
}: {
  readonly board: Board;
  readonly game: Game;
  readonly dispatch: (action: GameAction) => void;
  readonly onAbandon: () => void;
}) {
  const buzzers = useBuzzers(game, board, dispatch);
  const [menuOpen, setMenuOpen] = useState(false);
  // A game with phones begins in the lobby: the join code, up until the first clue.
  const [joinOpen, setJoinOpen] = useState(
    () => game.buzzers !== null && game.open === null && Object.keys(game.results).length === 0,
  );
  const [morphKey, setMorphKey] = useState<CellKey | null>(game.open?.key ?? null);
  const fullscreen = useFullscreen();

  const open = useCallback(
    (key: CellKey) => {
      // Name the tile first, so the transition knows what the card grows out of.
      flushSync(() => setMorphKey(key));
      void morph(() => dispatch({ type: "open", key }));
    },
    [dispatch],
  );

  const leaveClue = useCallback(
    (action: Extract<GameAction, { type: "close" | "putBack" }>) => {
      // Back on the board, the keyboard carries on from the tile that was just played.
      void morph(() => dispatch(action)).then(() =>
        morphKey === null ? undefined : focusTile(morphKey),
      );
    },
    [dispatch, morphKey],
  );

  const mark = useCallback(
    (teamId: string, verdict: Verdict) => dispatch({ type: "mark", teamId, verdict }),
    [dispatch],
  );

  const playing = !game.ended;
  const openClue = playing ? game.open : null;
  const teams = game.teams;
  const toggleFullscreen = fullscreen.toggle;
  const round = buzzers?.round ?? null;
  const armBuzzers = buzzers?.arm;
  const buzzedTeamId = round?.winner?.teamId;

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "f") return toggleFullscreen();
      if (key === "m") return setMenuOpen(true);
      if (openClue === null) return;

      if (key === "b" && round?.phase === "locked") return armBuzzers?.();
      if (buzzedTeamId !== undefined && (key === "y" || key === "n")) {
        return mark(buzzedTeamId, key === "y" ? "correct" : "wrong");
      }
      const digit = /^Digit([1-6])$/.exec(event.code)?.[1];
      const team = digit === undefined ? undefined : teams[Number(digit) - 1];
      if (team !== undefined) {
        event.preventDefault();
        return mark(team.id, event.shiftKey ? "wrong" : "correct");
      }
      if (event.key === "Escape") return leaveClue({ type: "close" });
      // A focused button already acts on Space and Enter by itself.
      if (isControl(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        return dispatch({ type: "reveal", revealed: !openClue.revealed });
      }
      if (event.key === "Enter") return leaveClue({ type: "close" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    playing,
    openClue,
    teams,
    round?.phase,
    buzzedTeamId,
    armBuzzers,
    dispatch,
    mark,
    leaveClue,
    toggleFullscreen,
  ]);

  if (game.ended) {
    return (
      <Finale
        board={board}
        game={game}
        onPlayAgain={() => dispatch({ type: "restart" })}
        onBackToBoard={() => dispatch({ type: "resume" })}
        onNewTeams={() => {
          // New teams means a new game, and a new room for it.
          buzzers?.close();
          onAbandon();
        }}
      />
    );
  }

  const left = remainingKeys(game, board).length;
  const category =
    game.open === null ? undefined : board.categories[parseCellKey(game.open.key).category];
  const buzzedTeam = teams.find((team) => team.id === buzzedTeamId);
  const phones = buzzers?.view?.players.filter((player) => player.online).length ?? 0;

  // Buzzing only concerns a clue whose answer isn't up yet.
  const buzz: ClueBuzz | null =
    buzzers === null || game.open === null || game.open.revealed
      ? null
      : {
          phase: buzzers.status === "online" ? (round?.phase ?? null) : null,
          answering:
            buzzedTeam === undefined
              ? null
              : { team: buzzedTeam, player: round?.winner?.name ?? "" },
          onArm: buzzers.arm,
          onClear: buzzers.clear,
          onVerdict: (verdict) =>
            buzzedTeam === undefined ? undefined : mark(buzzedTeam.id, verdict),
        };

  return (
    <div className="stage flex h-dvh flex-col overflow-hidden [--gap:clamp(5px,0.8vw,14px)] [--pad:clamp(8px,1.4vw,24px)]">
      <header className="flex flex-none items-center gap-3 px-(--pad) pt-[clamp(6px,1vh,14px)]">
        <LogoMark className="size-7 flex-none" />
        <h1 className="min-w-0 truncate text-[clamp(1rem,1.5vw,1.4rem)] font-extrabold tracking-tight">
          {board.title.trim() === "" ? "Untitled board" : board.title}
        </h1>
        <p className="flex-none text-sm font-semibold text-ink-400">
          {left === 0 ? "All played" : `${left} left`}
        </p>
        <div className="ml-auto flex flex-none items-center gap-1">
          {buzzers === null ? null : (
            <button
              type="button"
              title="Show how to join"
              aria-label={`Join code ${buzzers.code}, ${phones} connected. Show how to join.`}
              onClick={() => setJoinOpen(true)}
              className={cx(
                "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-extrabold ring-1 ring-inset transition duration-150 hover:bg-white/10",
                buzzers.status === "online"
                  ? "bg-white/6 text-ink-200 ring-white/10"
                  : "bg-bad/15 text-bad ring-bad/30",
              )}
            >
              <Icon name="phone" />
              <span className="tracking-widest text-brass-300">{buzzers.code}</span>
              <span className="tabular-nums">{phones}</span>
            </button>
          )}
          {fullscreen.supported ? (
            <IconButton
              icon={fullscreen.active ? "exitFullscreen" : "enterFullscreen"}
              label={fullscreen.active ? "Leave full screen (F)" : "Full screen (F)"}
              onClick={fullscreen.toggle}
            />
          ) : null}
          <IconButton icon="menu" label="Game menu (M)" onClick={() => setMenuOpen(true)} />
        </div>
      </header>

      <main className="relative min-h-0 flex-1 p-(--pad)">
        <BoardGrid board={board} game={game} morphKey={morphKey} onOpen={open} />
        {game.open === null ? null : (
          <ClueCard
            key={game.open.key}
            category={
              category === undefined || category.name.trim() === ""
                ? `Category ${parseCellKey(game.open.key).category + 1}`
                : category.name
            }
            value={valueAt(board, game.open.key)}
            clue={clueAt(board, game.open.key)}
            revealed={game.open.revealed}
            touched={isOpenClueTouched(game)}
            buzz={buzz}
            onReveal={(revealed) => dispatch({ type: "reveal", revealed })}
            onClose={() => leaveClue({ type: "close" })}
            onPutBack={() => leaveClue({ type: "putBack" })}
          />
        )}
      </main>

      <Scoreboard
        board={board}
        game={game}
        room={buzzers === null ? undefined : buzzers.view}
        onMark={mark}
      />

      <GameMenu
        open={menuOpen}
        board={board}
        game={game}
        onClose={() => setMenuOpen(false)}
        onShowJoin={buzzers === null ? undefined : () => setJoinOpen(true)}
        onAdjust={(teamId, delta) => dispatch({ type: "adjust", teamId, delta })}
        onEnd={() => dispatch({ type: "end" })}
        onRestart={() => dispatch({ type: "restart" })}
      />

      {buzzers === null ? null : (
        <JoinDialog
          open={joinOpen}
          buzzers={buzzers}
          started={Object.keys(game.results).length > 0}
          onClose={() => setJoinOpen(false)}
        />
      )}
    </div>
  );
}
