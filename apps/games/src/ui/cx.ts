/** Joins class names, skipping the ones switched off. */
export const cx = (...parts: ReadonlyArray<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");
