import { Link, useRouter } from "@tanstack/react-router";
import { Fragment, type KeyboardEvent, useRef, useState } from "react";
import {
  boardProgress,
  CELL_KEYS,
  type CellKey,
  cellKey,
  CLUE_COUNT,
  clueAt,
  isReady,
  LIMITS,
  missingForPublish,
  parseCellKey,
} from "#/game/board";
import type { Board, BoardContent, Clue } from "#/game/schema";
import { Button, buttonClass, IconButton, iconButtonClass } from "#/ui/Button";
import { cx } from "#/ui/cx";
import { Icon } from "#/ui/Icon";
import { Kbd } from "#/ui/Kbd";
import { StatusPill } from "#/ui/StatusPill";
import { type SaveStatus, useBoardEditor } from "./useBoardEditor";

const withClue = (content: BoardContent, key: CellKey, change: Partial<Clue>): BoardContent => {
  const at = parseCellKey(key);
  return {
    ...content,
    categories: content.categories.map((category, categoryIndex) =>
      categoryIndex === at.category
        ? {
            ...category,
            clues: category.clues.map((clue, row) =>
              row === at.row ? { ...clue, ...change } : clue,
            ),
          }
        : category,
    ),
  };
};

const withCategoryName = (content: BoardContent, index: number, name: string): BoardContent => ({
  ...content,
  categories: content.categories.map((category, categoryIndex) =>
    categoryIndex === index ? { ...category, name } : category,
  ),
});

const withValue = (content: BoardContent, row: number, value: number): BoardContent => ({
  ...content,
  values: content.values.map((current, index) => (index === row ? value : current)),
});

const listOf = (parts: ReadonlyArray<string>) =>
  new Intl.ListFormat("en", { type: "conjunction" }).format(parts);

function SaveIndicator({
  status,
  onRetry,
}: {
  readonly status: SaveStatus;
  readonly onRetry: () => void;
}) {
  if (status === "failed") {
    return (
      <Button variant="danger" size="sm" onClick={onRetry}>
        Not saved · Retry
      </Button>
    );
  }
  if (status === "conflict" || status === "gone") return null;
  return (
    <p
      role="status"
      className="flex flex-none items-center gap-1.5 text-sm font-semibold text-ink-400"
    >
      {status === "pending" ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-ink-500 border-t-brass-400" />
      ) : (
        <Icon name="check" className="text-good" />
      )}
      <span className="hidden sm:inline">{status === "pending" ? "Saving…" : "Saved"}</span>
    </p>
  );
}

/** One clue in the overview grid. */
function Cell({
  clue,
  label,
  selected,
  onSelect,
}: {
  readonly clue: Clue;
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const hasClue = clue.clue.trim() !== "";
  const hasAnswer = clue.answer.trim() !== "";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      className={cx(
        "flex h-[6.5rem] min-w-0 flex-col rounded-xl p-2.5 text-left transition duration-150",
        selected
          ? "bg-ink-700 shadow-[inset_0_0_0_2px_var(--color-brass-400),0_10px_30px_-12px_oklch(0.76_0.14_80/0.5)]"
          : "bg-ink-850 shadow-[inset_0_0_0_1px_oklch(1_0_0/0.07)] hover:bg-ink-800",
      )}
    >
      {hasClue ? (
        <span className="line-clamp-3 text-[0.8rem] font-medium leading-snug text-ink-200">
          {clue.clue}
        </span>
      ) : (
        <span className="m-auto flex items-center gap-1 text-sm font-bold text-ink-500">
          <Icon name="plus" />
          {hasAnswer ? "Clue" : "Add"}
        </span>
      )}
      {hasClue || hasAnswer ? (
        <span
          className={cx(
            "mt-auto w-full truncate pt-1 text-[0.72rem] font-extrabold",
            hasAnswer ? "text-brass-300" : "text-bad",
          )}
        >
          {hasAnswer ? clue.answer : "No answer yet"}
        </span>
      ) : null}
    </button>
  );
}

/** Edits one board: the 5×5 overview on the left, the selected clue on the right. */
export function BoardEditor({ board }: { readonly board: Board }) {
  const router = useRouter();
  const { content, published, status, setContent, setPublished, retry } = useBoardEditor(board);
  const [selected, setSelected] = useState<CellKey>(
    () => CELL_KEYS.find((key) => !isReady(clueAt(board, key))) ?? cellKey(0, 0),
  );
  const clueField = useRef<HTMLTextAreaElement>(null);

  const progress = boardProgress(content);
  const missing = missingForPublish(content);
  const at = parseCellKey(selected);
  const clue = clueAt(content, selected);
  const categoryName = (index: number) => {
    const name = content.categories[index]?.name.trim() ?? "";
    return name === "" ? `Category ${index + 1}` : name;
  };
  const halted = status === "conflict" || status === "gone";

  const select = (key: CellKey) => {
    setSelected(key);
    clueField.current?.focus();
  };

  /** Walks the board the way it is written: down a category, then on to the next. */
  const step = (direction: 1 | -1) => {
    const index = (CELL_KEYS.indexOf(selected) + direction + CLUE_COUNT) % CLUE_COUNT;
    select(CELL_KEYS[index] ?? selected);
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    step(event.shiftKey ? -1 : 1);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/8 bg-ink-950/75 px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-6">
        <Link to="/admin" className={iconButtonClass()} aria-label="All boards" title="All boards">
          <Icon name="arrowLeft" />
        </Link>
        <input
          aria-label="Board title"
          placeholder="Untitled board"
          maxLength={LIMITS.title}
          value={content.title}
          disabled={halted}
          onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))}
          className="semi-condensed min-w-0 flex-1 rounded-xl bg-transparent px-2.5 py-1.5 text-xl font-extrabold tracking-tight outline-none transition placeholder:text-ink-500 hover:bg-white/5 focus:bg-white/8 sm:text-2xl"
        />
        <SaveIndicator status={status} onRetry={() => void retry()} />
        <Link
          to="/play/$boardId"
          params={{ boardId: board.id }}
          className={buttonClass({ size: "sm" })}
          title="Play this board"
        >
          <Icon name="play" />
          <span className="hidden sm:inline">Play</span>
        </Link>
        {published ? (
          <Button size="sm" disabled={halted} onClick={() => setPublished(false)}>
            Unpublish
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!progress.complete || halted}
            title={progress.complete ? "Put it on the front page" : `Needs ${listOf(missing)}`}
            onClick={() => setPublished(true)}
          >
            Publish
          </Button>
        )}
      </header>

      {status === "conflict" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 bg-bad/15 px-4 py-3 font-semibold text-bad sm:px-6"
        >
          This board was changed somewhere else, so this copy can't be saved any more.
          <Button variant="danger" size="sm" onClick={() => void router.invalidate()}>
            Load the latest version
          </Button>
        </div>
      ) : null}
      {status === "gone" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 bg-bad/15 px-4 py-3 font-semibold text-bad sm:px-6"
        >
          This board has been deleted.
          <Link to="/admin" className={buttonClass({ variant: "danger", size: "sm" })}>
            Back to boards
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-5 sm:px-6">
        <StatusPill published={published} />
        <span
          className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-700"
          role="progressbar"
          aria-label="Clues ready"
          aria-valuemin={0}
          aria-valuemax={CLUE_COUNT}
          aria-valuenow={progress.readyClues}
        >
          <span
            className="block h-full rounded-full bg-brass-400 transition-[width] duration-500 ease-out-expo"
            style={{ width: `${(progress.readyClues / CLUE_COUNT) * 100}%` }}
          />
        </span>
        <p className="text-sm text-ink-300">
          {progress.complete
            ? published
              ? "Complete and on the front page."
              : "Complete. Publish it to put it on the front page."
            : `Still needs ${listOf(missing)}.`}
        </p>
      </div>

      <main
        inert={halted}
        className="grid flex-1 items-start gap-6 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]"
      >
        <section
          aria-label="Board"
          className="-mx-4 min-w-0 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        >
          <div className="grid min-w-[42rem] grid-cols-[3.5rem_repeat(5,minmax(0,1fr))] gap-2">
            <span className="self-center text-center text-[0.65rem] font-extrabold uppercase tracking-widest text-ink-500">
              Points
            </span>
            {content.categories.map((category, index) => (
              <input
                key={index}
                aria-label={`Name of category ${index + 1}`}
                placeholder={`Category ${index + 1}`}
                maxLength={LIMITS.category}
                value={category.name}
                onChange={(event) =>
                  setContent((current) => withCategoryName(current, index, event.target.value))
                }
                className="field semi-condensed h-12 min-w-0 px-2 text-center text-sm font-extrabold uppercase tracking-wide"
              />
            ))}
            {content.values.map((value, row) => (
              <Fragment key={row}>
                <input
                  aria-label={`Points for row ${row + 1}`}
                  inputMode="numeric"
                  value={String(value)}
                  onChange={(event) => {
                    const points = Number(event.target.value.replaceAll(/\D/g, ""));
                    setContent((current) =>
                      withValue(current, row, Math.min(points, LIMITS.value)),
                    );
                  }}
                  className="field condensed h-[6.5rem] min-w-0 px-1 text-center text-lg font-extrabold tabular-nums text-brass-300"
                />
                {content.categories.map((category, categoryIndex) => {
                  const key = cellKey(categoryIndex, row);
                  return (
                    <Cell
                      key={key}
                      clue={category.clues[row] ?? { clue: "", answer: "" }}
                      label={`${categoryName(categoryIndex)}, ${value} points`}
                      selected={key === selected}
                      onSelect={() => select(key)}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </section>

        <aside
          aria-label="Selected clue"
          className="surface rounded-3xl p-5 sm:p-6 lg:sticky lg:top-[4.75rem]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow truncate">{categoryName(at.category)}</p>
              <p className="brass-text condensed mt-1 text-5xl font-extrabold leading-none tabular-nums">
                {content.values[at.row] ?? 0}
              </p>
            </div>
            <div className="flex flex-none">
              <IconButton icon="arrowLeft" label="Previous clue" onClick={() => step(-1)} />
              <IconButton icon="arrowRight" label="Next clue" onClick={() => step(1)} />
            </div>
          </div>

          <label className="mt-5 block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-extrabold">Clue</span>
              <span className="text-xs tabular-nums text-ink-400">
                {clue.clue.length}/{LIMITS.clue}
              </span>
            </span>
            <textarea
              ref={clueField}
              placeholder="What everyone reads on the big screen"
              maxLength={LIMITS.clue}
              value={clue.clue}
              onChange={(event) =>
                setContent((current) => withClue(current, selected, { clue: event.target.value }))
              }
              onKeyDown={onFieldKeyDown}
              className="field mt-2 block min-h-36 resize-y p-3.5 text-lg font-semibold leading-snug [field-sizing:content]"
            />
          </label>

          <label className="mt-4 block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-extrabold">Answer</span>
              <span className="text-xs tabular-nums text-ink-400">
                {clue.answer.length}/{LIMITS.answer}
              </span>
            </span>
            <textarea
              placeholder="What the host reveals"
              maxLength={LIMITS.answer}
              value={clue.answer}
              onChange={(event) =>
                setContent((current) => withClue(current, selected, { answer: event.target.value }))
              }
              onKeyDown={onFieldKeyDown}
              className="field mt-2 block min-h-20 resize-y p-3.5 text-lg font-extrabold leading-snug text-brass-300 [field-sizing:content]"
            />
          </label>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-ink-400">
              <Kbd>Ctrl</Kbd>
              <Kbd>Enter</Kbd>
              <span className="hidden [@media(hover:hover)]:inline">jumps to the next clue</span>
            </p>
            <Button variant="primary" size="sm" onClick={() => step(1)}>
              Next clue
              <Icon name="arrowRight" />
            </Button>
          </div>
        </aside>
      </main>
    </div>
  );
}
