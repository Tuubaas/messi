/**
 * How rules meet descriptions. A rule's pattern matches when the transaction's match text
 * contains it. The database applies rules with the same two definitions (`instr`, longest
 * pattern first), so what the UI previews here is what a save does.
 */

/**
 * The text rules are matched against: lowercase, single spaces. Lowercasing happens here
 * and not in SQL because SQLite's `lower()` only knows ASCII ("ICA NÄRA" would stay "Ä").
 */
export const matchText = (description: string) =>
  description.toLowerCase().replaceAll(/\s+/g, " ").trim();

export const patternMatches = (pattern: string, text: string) => text.includes(pattern);

/**
 * A starting pattern for "everything like this one": the description without the parts
 * that change from purchase to purchase (dates, card and reference numbers, amounts).
 */
export const suggestPattern = (description: string) => {
  const words = matchText(description)
    .split(" ")
    .filter((word) => word.replaceAll(/\D/g, "").length < 3 && !/^\d+([./:-]\d+)*$/.test(word))
    .map((word) => word.replaceAll(/^[*#:,;.-]+|[*#:,;.-]+$/g, ""))
    .filter((word) => word !== "");
  const pattern = words.join(" ");
  return pattern.length >= 2 ? pattern : matchText(description);
};

interface Scored {
  readonly id: number;
  readonly pattern: string;
}

/** The rule that wins for a text: the longest matching pattern, the newest on a tie. */
export const winningRule = <R extends Scored>(rules: ReadonlyArray<R>, text: string) => {
  let best: R | undefined;
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, text)) continue;
    if (
      best === undefined ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.id > best.id)
    ) {
      best = rule;
    }
  }
  return best;
};
