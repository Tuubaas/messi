import { type Aggregate, capSeries, OTHER, type Series, UNCATEGORISED } from "#/domain/aggregate";
import { OWNERS, type ViewConfig, type Workspace } from "#/domain/model";

/**
 * Which colour each series of a chart gets. The palette is eight hues in a fixed order
 * (`styles.css`), handed out in sequence because it was checked for neighbours: only
 * hues next to each other in that order are guaranteed to be told apart in a stack.
 */

export interface ChartSeries extends Series {
  readonly color: string;
}

/** Seven series and "Other": more colours than that stop being tellable apart. */
const SERIES_LIMIT = 8;

const slot = (index: number) => `var(--series-${index + 1})`;

export const OTHER_COLOR = "var(--series-other)";
export const NEGATIVE_COLOR = "var(--series-negative)";

/**
 * The series a chart draws, in stack and legend order, with colours. The order follows
 * the entity (the category list, the account list), never the ranking, so a month in
 * which groceries overtake rent does not repaint either of them.
 */
export const chartSeries = (
  result: Aggregate,
  config: ViewConfig,
  workspace: Pick<Workspace, "categories" | "accounts">,
): ReadonlyArray<ChartSeries> => {
  if (config.groupBy === "owner") {
    // Three fixed colours: mine is always the first hue, whoever else is on screen.
    return OWNERS.flatMap((owner, index) => {
      const series = result.series.find((entry) => entry.key === owner);
      return series === undefined ? [] : [{ ...series, color: slot(index) }];
    });
  }
  const order = new Map<string, number>(
    (config.groupBy === "account" ? workspace.accounts : workspace.categories).map(
      (entity, index) => [String(entity.id), index],
    ),
  );
  const rank = (key: string) =>
    key === OTHER ? Infinity : key === UNCATEGORISED ? 1e9 : (order.get(key) ?? 1e8);
  return capSeries(result.series, SERIES_LIMIT)
    .toSorted((a, b) => rank(a.key) - rank(b.key))
    .map((series, index) => ({
      ...series,
      color: series.key === OTHER ? OTHER_COLOR : slot(index),
    }));
};
