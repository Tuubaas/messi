import { MEASURE_LABELS, OWNER_LABELS } from "#/domain/aggregate";
import { formatDate, PERIOD_LABELS } from "#/domain/dates";
import type { ViewConfig } from "#/domain/model";

/** The words the view editor and the cards use for each setting. */

export const CHART_LABELS: Record<ViewConfig["chart"], string> = {
  bar: "Bars",
  line: "Lines",
  breakdown: "Ranking",
  table: "Table",
};

export const GROUP_LABELS: Record<ViewConfig["groupBy"], string> = {
  category: "Category",
  account: "Account",
  owner: "Owner",
  none: "Nothing",
};

export const INTERVAL_LABELS: Record<ViewConfig["interval"], string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

export const periodLabel = (period: ViewConfig["period"]) =>
  period.preset === "custom"
    ? `${formatDate(period.from)} – ${formatDate(period.to)}`
    : PERIOD_LABELS[period.preset];

const ownersLabel = (config: ViewConfig) => {
  if (config.owners.length === 3) return "Everyone";
  if (config.owners.length === 0) return "Nobody";
  return config.owners.map((owner) => OWNER_LABELS[owner]).join(" + ");
};

const count = (amount: number, one: string, many: string) =>
  `${amount} ${amount === 1 ? one : many}`;

/** One line saying what a view counts: "Spending · Last 12 months · Mine + Shared". */
export const describeView = (config: ViewConfig) =>
  [
    MEASURE_LABELS[config.measure],
    periodLabel(config.period),
    ownersLabel(config) + (config.splitShared ? " (my share of shared)" : ""),
    config.accountIds === null ? null : count(config.accountIds.length, "account", "accounts"),
    config.categoryIds === null ? null : count(config.categoryIds.length, "category", "categories"),
  ]
    .filter((part) => part !== null)
    .join(" · ");
