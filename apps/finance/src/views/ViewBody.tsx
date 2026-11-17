import { useWorkspace } from "#/api/queries";
import type { Aggregate } from "#/domain/aggregate";
import type { ViewConfig } from "#/domain/model";
import { cx } from "#/ui/cx";
import { Legend, Lines, PivotTable, RankedBars, StackedBars } from "./charts";
import { GROUP_LABELS } from "./labels";
import { chartSeries } from "./series";

function Placeholder({ height, children }: { readonly height: number; readonly children: string }) {
  return (
    <div className="grid place-items-center text-sm text-muted" style={{ minHeight: height }}>
      {children}
    </div>
  );
}

/**
 * Draws what a view worked out, in the form the view asks for, or as a table when
 * `asTable` is set. While newer data loads the last drawing stays, dimmed: no flash.
 */
export function ViewBody({
  config,
  result,
  isFetching,
  error,
  asTable = false,
  height = 260,
}: {
  readonly config: ViewConfig;
  readonly result: Aggregate | undefined;
  readonly isFetching: boolean;
  readonly error: Error | null;
  readonly asTable?: boolean;
  readonly height?: number;
}) {
  const workspace = useWorkspace();
  if (result === undefined) {
    return (
      <Placeholder height={height}>
        {error === null ? "Loading…" : "The transactions could not be loaded."}
      </Placeholder>
    );
  }
  if (result.count === 0) {
    return <Placeholder height={height}>No transactions for this view in this period.</Placeholder>;
  }
  const { currency } = workspace.settings;
  const series = chartSeries(result, config, workspace);
  const chart = { result, series, currency, height };

  let body;
  if (asTable || config.chart === "table") {
    body = (
      <PivotTable result={result} currency={currency} groupLabel={GROUP_LABELS[config.groupBy]} />
    );
  } else if (config.chart === "breakdown") {
    body = <RankedBars result={result} currency={currency} />;
  } else if (config.chart === "line") {
    body = (
      <>
        <Lines {...chart} />
        <Legend series={series} mark="line" />
      </>
    );
  } else {
    body = (
      <>
        <StackedBars
          {...chart}
          signColoured={config.measure === "net" && config.groupBy === "none"}
        />
        <Legend series={series} mark="bar" />
      </>
    );
  }
  return <div className={cx("transition-opacity", isFetching && "opacity-60")}>{body}</div>;
}
