/** Joins class names, skipping the ones that are switched off. */
export const cx = (...classes: ReadonlyArray<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
