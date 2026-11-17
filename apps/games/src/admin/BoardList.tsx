import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { copyBoard, createNewBoard, deleteBoard } from "#/boards/functions";
import { type BoardSummary, CLUE_COUNT } from "#/game/board";
import { Button, IconButton, iconButtonClass } from "#/ui/Button";
import { Dialog } from "#/ui/Dialog";
import { Icon } from "#/ui/Icon";
import { MiniBoard } from "#/ui/MiniBoard";
import { StatusPill } from "#/ui/StatusPill";
import { timeAgo } from "#/ui/time";

const titleOf = (board: BoardSummary) =>
  board.title.trim() === "" ? "Untitled board" : board.title;

function BoardRow({
  board,
  busy,
  onDuplicate,
  onDelete,
}: {
  readonly board: BoardSummary;
  readonly busy: boolean;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}) {
  const categories = board.categories.filter((name) => name.trim() !== "");
  return (
    <li className="surface group relative flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl p-4 transition duration-200 hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_0_0_2px_var(--color-brass-400),0_20px_40px_-24px_oklch(0_0_0/0.7)] sm:px-6 sm:py-5">
      <div className="min-w-0 flex-1 basis-72">
        <div className="flex items-center gap-3">
          {/* The title's link covers the whole row; the buttons sit on top of it. */}
          <Link
            to="/admin/$boardId"
            params={{ boardId: board.id }}
            preload={false}
            className="semi-condensed min-w-0 truncate text-2xl font-extrabold tracking-tight outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-brass-400"
          >
            {titleOf(board)}
          </Link>
          <StatusPill published={board.published} />
        </div>
        <p className="mt-1.5 truncate text-sm text-ink-400">
          {categories.length === 0 ? "No categories yet" : categories.join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-3 text-sm text-ink-300">
        <span
          className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700"
          role="progressbar"
          aria-label="Clues ready"
          aria-valuemin={0}
          aria-valuemax={CLUE_COUNT}
          aria-valuenow={board.readyClues}
        >
          <span
            className="block h-full rounded-full bg-brass-400"
            style={{ width: `${(board.readyClues / CLUE_COUNT) * 100}%` }}
          />
        </span>
        <span className="tabular-nums">
          {board.readyClues}/{CLUE_COUNT} clues
        </span>
        <time
          className="hidden text-ink-400 md:block"
          dateTime={new Date(board.updatedAt).toISOString()}
          // The server's clock and the browser's differ by the length of the request.
          suppressHydrationWarning
        >
          Edited {timeAgo(board.updatedAt)}
        </time>
      </div>

      <div className="relative z-10 flex items-center">
        <Link
          to="/play/$boardId"
          params={{ boardId: board.id }}
          className={iconButtonClass()}
          aria-label={`Play ${titleOf(board)}`}
          title="Play"
        >
          <Icon name="play" />
        </Link>
        <IconButton icon="copy" label="Duplicate" disabled={busy} onClick={onDuplicate} />
        <IconButton
          icon="trash"
          label="Delete"
          className="hover:bg-bad/15 hover:text-bad"
          disabled={busy}
          onClick={onDelete}
        />
      </div>
    </li>
  );
}

/** The admin's front page: every board, drafts included, and the way to make more. */
export function BoardList({ boards }: { readonly boards: ReadonlyArray<BoardSummary> }) {
  const router = useRouter();
  const navigate = useNavigate();
  const create = useServerFn(createNewBoard);
  const copy = useServerFn(copyBoard);
  const remove = useServerFn(deleteBoard);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<BoardSummary | null>(null);
  // Keeps the dialog's text in place while it animates out.
  const [lastDeleting, setLastDeleting] = useState<BoardSummary | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await work();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const createBoard = (template: "blank" | "sample") =>
    run(async () => {
      const { id } = await create({ data: { template } });
      await navigate({ to: "/admin/$boardId", params: { boardId: id } });
    });

  const duplicate = (board: BoardSummary) =>
    run(async () => {
      await copy({ data: { id: board.id } });
      await router.invalidate({ sync: true });
    });

  const confirmDelete = (board: BoardSummary) =>
    run(async () => {
      await remove({ data: { id: board.id } });
      setDeleting(null);
      await router.invalidate({ sync: true });
    });

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-6 sm:px-8 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="semi-condensed text-5xl font-extrabold tracking-tight sm:text-6xl">
            Boards
          </h1>
          <p className="mt-2 text-ink-300">
            Drafts are yours alone. Published boards are on the front page for anyone to play.
          </p>
        </div>
        {boards.length === 0 ? null : (
          <Button variant="primary" disabled={busy} onClick={() => void createBoard("blank")}>
            <Icon name="plus" />
            New board
          </Button>
        )}
      </div>

      {failed ? (
        <p
          role="alert"
          className="mt-6 rounded-2xl bg-bad/12 px-4 py-3 font-semibold text-bad ring-1 ring-inset ring-bad/30"
        >
          That didn't work. Check your connection and try again.
        </p>
      ) : null}

      {boards.length === 0 ? (
        <div className="surface mt-10 flex animate-rise flex-col items-center rounded-3xl px-6 py-14 text-center">
          <MiniBoard className="size-20" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Make your first board</h2>
          <p className="mt-2 max-w-md text-pretty text-ink-300">
            Start from an empty 5×5, or open the sample board to see how one is put together and
            make it your own.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => void createBoard("blank")}
            >
              <Icon name="plus" />
              New board
            </Button>
            <Button size="lg" disabled={busy} onClick={() => void createBoard("sample")}>
              Start from the sample
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-8 grid animate-rise gap-3">
          {boards.map((board) => (
            <BoardRow
              key={board.id}
              board={board}
              busy={busy}
              onDuplicate={() => void duplicate(board)}
              onDelete={() => {
                setDeleting(board);
                setLastDeleting(board);
              }}
            />
          ))}
        </ul>
      )}

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete board">
        <h2 className="text-2xl font-extrabold tracking-tight text-balance">
          Delete “{lastDeleting === null ? "" : titleOf(lastDeleting)}”?
        </h2>
        <p className="mt-2 text-ink-300">
          Its {CLUE_COUNT} clues go with it. This can't be undone.
        </p>
        <div className="mt-7 flex justify-end gap-2.5">
          <Button onClick={() => setDeleting(null)}>Keep it</Button>
          <Button
            variant="danger"
            disabled={busy || deleting === null}
            onClick={() => (deleting === null ? undefined : void confirmDelete(deleting))}
          >
            <Icon name="trash" />
            Delete board
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
