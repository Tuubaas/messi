import { type ReactNode, useSyncExternalStore } from "react";
import { Button } from "./controls";

/**
 * Short messages at the bottom of the screen: a save that failed, or a follow-up offer
 * ("apply to all like this"). One list for the whole app, outside React so that the
 * query client can report errors too.
 */
export interface Notice {
  readonly id: number;
  readonly tone: "error" | "info";
  readonly message: string;
  readonly action?: { readonly label: string; readonly run: () => void };
}

let notices: ReadonlyArray<Notice> = [];
let nextId = 1;
const listeners = new Set<() => void>();

const publish = (next: ReadonlyArray<Notice>) => {
  notices = next;
  for (const listener of listeners) listener();
};

export const dismissNotice = (id: number) => publish(notices.filter((notice) => notice.id !== id));

export const notify = (notice: Omit<Notice, "id">) => {
  const id = nextId++;
  // An offer to act needs longer on screen than a message to read.
  const lifetimeMs = notice.action === undefined ? 8000 : 20_000;
  // Newest last; never more than three on screen.
  publish([...notices, { ...notice, id }].slice(-3));
  setTimeout(() => dismissNotice(id), lifetimeMs);
};

export const notifyError = (error: unknown) =>
  notify({
    tone: "error",
    message: error instanceof Error ? error.message : "Something went wrong. Try again.",
  });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const read = () => notices;

export function Notices(): ReactNode {
  const current = useSyncExternalStore(subscribe, read, read);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {current.map((notice) => (
        <div
          key={notice.id}
          role={notice.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-lg border border-line-strong bg-surface py-2 pr-2 pl-3.5 text-sm shadow-lg"
        >
          <span className={notice.tone === "error" ? "text-danger" : undefined}>
            {notice.message}
          </span>
          {notice.action === undefined ? null : (
            <Button
              small
              variant="primary"
              onClick={() => {
                notice.action?.run();
                dismissNotice(notice.id);
              }}
            >
              {notice.action.label}
            </Button>
          )}
          <Button
            small
            variant="ghost"
            aria-label="Dismiss"
            onClick={() => dismissNotice(notice.id)}
          >
            ✕
          </Button>
        </div>
      ))}
    </div>
  );
}
