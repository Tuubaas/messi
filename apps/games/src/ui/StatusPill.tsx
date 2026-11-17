import { cx } from "./cx";

/** Whether a board is on the front page or still the admin's draft. */
export function StatusPill({ published }: { readonly published: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider ring-1 ring-inset",
        published ? "bg-good/12 text-good ring-good/30" : "bg-white/6 text-ink-300 ring-white/12",
      )}
    >
      <span className={cx("size-1.5 rounded-full", published ? "bg-good" : "bg-ink-400")} />
      {published ? "Published" : "Draft"}
    </span>
  );
}
