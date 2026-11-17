import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { listPublishedBoards } from "#/boards/functions";
import type { BoardSummary } from "#/game/board";
import type { Game } from "#/game/game";
import { loadGame } from "#/play/storage";
import { buttonClass } from "#/ui/Button";
import { Icon } from "#/ui/Icon";
import { Logo } from "#/ui/Logo";
import { MiniBoard } from "#/ui/MiniBoard";

export const Route = createFileRoute("/")({
  loader: () => listPublishedBoards(),
  component: Hub,
});

function BoardCard({ board, game }: { readonly board: BoardSummary; readonly game: Game | null }) {
  const inProgress = game !== null && !game.ended;
  return (
    <Link
      to="/play/$boardId"
      params={{ boardId: board.id }}
      className="surface group flex h-full flex-col rounded-3xl p-6 transition duration-300 ease-out-expo hover:-translate-y-1.5 hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_0_0_2px_var(--color-brass-400),0_30px_60px_-28px_oklch(0.76_0.14_80/0.55)]"
    >
      <div className="flex items-start justify-between gap-4">
        <MiniBoard game={game} />
        {inProgress ? (
          <span className="animate-fade rounded-full bg-brass-400/15 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-brass-300 ring-1 ring-inset ring-brass-400/40">
            In progress
          </span>
        ) : null}
      </div>
      <h2 className="semi-condensed mt-6 text-3xl font-extrabold leading-none tracking-tight text-balance">
        {board.title}
      </h2>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {board.categories.map((category, index) => (
          <li
            key={index}
            className="rounded-full bg-white/6 px-2.5 py-1 text-xs font-semibold text-ink-200"
          >
            {category}
          </li>
        ))}
      </ul>
      <span className="mt-auto flex items-center gap-2 pt-7 text-lg font-extrabold text-brass-300">
        {inProgress ? "Pick up the game" : "Play"}
        <Icon
          name="arrowRight"
          className="transition-transform duration-300 ease-out-expo group-hover:translate-x-1.5"
        />
      </span>
    </Link>
  );
}

/** The card, knowing about a game already started on this board in this browser. */
function BoardCardWithGame({ board }: { readonly board: BoardSummary }) {
  const [game] = useState(() => loadGame(board.id));
  return <BoardCard board={board} game={game} />;
}

function Hub() {
  const boards = Route.useLoaderData();

  return (
    <div className="stage min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo className="text-xl" />
        <nav className="flex items-center gap-1">
          <Link to="/join" className={buttonClass({ size: "sm" })}>
            <Icon name="phone" />
            Join a game
          </Link>
          <Link to="/admin" className={buttonClass({ variant: "ghost", size: "sm" })}>
            Admin
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-16">
        <h1 className="semi-condensed animate-rise text-6xl font-extrabold leading-[0.9] tracking-tight sm:text-8xl">
          Pick a <span className="brass-text">board.</span>
        </h1>
        <p className="mt-6 max-w-xl animate-rise text-lg text-pretty text-ink-300 [animation-delay:80ms] sm:text-xl">
          Five categories, twenty-five clues. Split into teams, put this on the big screen and take
          turns.
        </p>

        {boards.length === 0 ? (
          <div className="mt-12 flex max-w-xl animate-rise flex-col items-start rounded-3xl border border-dashed border-white/15 p-8 [animation-delay:160ms]">
            <MiniBoard className="opacity-60" />
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">No boards yet</h2>
            <p className="mt-2 text-ink-300">
              Boards show up here as soon as one is published in the admin.
            </p>
            <Link to="/admin" className={buttonClass({ variant: "primary", className: "mt-6" })}>
              Open the admin
            </Link>
          </div>
        ) : (
          <ul className="mt-12 grid animate-rise gap-5 [animation-delay:160ms] sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board.id}>
                {/* Saved games are in the browser's storage, which the server can't see. */}
                <ClientOnly fallback={<BoardCard board={board} game={null} />}>
                  <BoardCardWithGame board={board} />
                </ClientOnly>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
