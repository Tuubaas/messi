import { useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveBoardContent } from "#/boards/functions";
import { contentOf } from "#/game/board";
import type { Board, BoardContent } from "#/game/schema";

/**
 * - `saved`: everything typed is on the server
 * - `pending`: there are changes, and a save is on its way
 * - `failed`: the last save didn't get through; it is retried on the next change
 * - `conflict`: the board was saved elsewhere, so this copy can no longer be saved
 * - `gone`: the board was deleted
 */
export type SaveStatus = "saved" | "pending" | "failed" | "conflict" | "gone";

const SAVE_DELAY_MS = 700;

interface Draft {
  readonly content: BoardContent;
  readonly published: boolean;
}

/**
 * The editor's copy of a board. Every change is saved by itself a moment after typing
 * stops, one save at a time, and leaving the page waits for the last one.
 */
export function useBoardEditor(board: Board) {
  const [draft, setDraft] = useState<Draft>({
    content: contentOf(board),
    published: board.published,
  });
  const [status, setStatus] = useState<SaveStatus>("saved");
  const send = useServerFn(saveBoardContent);

  // What a save needs lives in refs: saves run from timers, long after the render they began in.
  const latest = useRef(draft);
  const revision = useRef(board.revision);
  const dirty = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saving = useRef<Promise<void> | null>(null);

  const saveNow = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    // One save at a time: each needs the revision the previous one returned.
    while (saving.current !== null) await saving.current;
    if (!dirty.current || stopped.current) return;

    const save = async () => {
      for (;;) {
        dirty.current = false;
        const result = await send({
          data: { id: board.id, revision: revision.current, ...latest.current },
        });
        if (result._tag === "Incomplete") {
          // The server refused to publish a board with gaps: keep it as a draft and save that.
          latest.current = { ...latest.current, published: false };
          setDraft(latest.current);
          continue;
        }
        if (result._tag === "Saved") {
          revision.current = result.revision;
          setStatus(dirty.current ? "pending" : "saved");
        } else {
          stopped.current = true;
          setStatus(result._tag === "Conflict" ? "conflict" : "gone");
        }
        return;
      }
    };

    saving.current = save()
      .catch(() => {
        dirty.current = true;
        setStatus("failed");
      })
      .finally(() => {
        saving.current = null;
      });
    await saving.current;
  }, [board.id, send]);

  const change = useCallback(
    (update: (draft: Draft) => Draft, when: "soon" | "now" = "soon") => {
      if (stopped.current) return;
      latest.current = update(latest.current);
      setDraft(latest.current);
      dirty.current = true;
      setStatus("pending");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveNow(), when === "now" ? 0 : SAVE_DELAY_MS);
    },
    [saveNow],
  );

  // Leaving for another page waits for the save, and asks before dropping one that failed.
  // Closing the tab mid-save asks too.
  useBlocker({
    shouldBlockFn: async () => {
      await saveNow();
      const unsaved = dirty.current && !stopped.current;
      // A plain confirm, because the router is waiting on the answer, as on a tab close.
      return unsaved && !window.confirm("Your last changes couldn't be saved. Leave anyway?");
    },
    enableBeforeUnload: () => dirty.current || saving.current !== null,
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const setContent = useCallback(
    (update: (content: BoardContent) => BoardContent) =>
      change((current) => ({ ...current, content: update(current.content) })),
    [change],
  );

  const setPublished = useCallback(
    (published: boolean) => change((current) => ({ ...current, published }), "now"),
    [change],
  );

  return { ...draft, status, setContent, setPublished, retry: saveNow };
}
