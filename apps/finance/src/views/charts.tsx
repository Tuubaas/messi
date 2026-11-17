import { type ReactNode, useMemo } from "react";
import {
  Bar,
  BarChart,
  type BarShapeProps,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Aggregate, Series } from "#/domain/aggregate";
import { formatCompact, formatMoneyRounded } from "#/domain/money";
import { cx } from "#/ui/cx";
import { type ChartSeries, NEGATIVE_COLOR } from "./series";

/**
 * The four ways a view is drawn. The rules they share: thin marks on hairline axes, a
 * 2px gap of surface between touching marks, text in text colours (the mark beside it
 * carries the colour), a tooltip that lists every series, and a legend for two or more.
 * Every chart can also be read as a table (`PivotTable`), so colour is never the only way.
 */

interface ChartProps {
  readonly result: Aggregate;
  readonly series: ReadonlyArray<ChartSeries>;
  readonly currency: string;
  readonly height: number;
}

const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const TIP_RADIUS = 4;

/** One row per bucket, one numbered column per series (`s_0`, `s_1`…). */
const chartRows = (result: Aggregate, series: ReadonlyArray<Series>) =>
  result.buckets.map((bucket, index) => {
    const row: Record<string, string | number> = { bucket: bucket.key };
    for (const [column, entry] of series.entries()) row[`s_${column}`] = entry.values[index] ?? 0;
    return row;
  });

const useAxis = (result: Aggregate) =>
  useMemo(() => {
    const labels = new Map(result.buckets.map((bucket) => [bucket.key, bucket.label]));
    return (key: string) => labels.get(key) ?? key;
  }, [result.buckets]);

const xAxis = (tickFormatter: (key: string) => string) => (
  <XAxis
    dataKey="bucket"
    tickFormatter={tickFormatter}
    tickLine={false}
    axisLine={{ stroke: "var(--line-strong)" }}
    interval="preserveStartEnd"
    minTickGap={14}
    tickMargin={6}
  />
);

const yAxis = (
  <YAxis
    width={56}
    tickLine={false}
    axisLine={false}
    tickFormatter={formatCompact}
    tickMargin={4}
  />
);

const grid = <CartesianGrid vertical={false} stroke="var(--line)" />;

/** Values lead, names follow: the reader already knows the series and wants the number. */
function ChartTooltip({
  active,
  bucket,
  result,
  series,
  currency,
}: Pick<ChartProps, "result" | "series" | "currency"> & {
  readonly active: boolean;
  readonly bucket: string | number | undefined;
}) {
  const index = result.buckets.findIndex((entry) => entry.key === bucket);
  if (!active || index < 0) return null;
  const rows = series
    .map((entry) => ({ ...entry, value: entry.values[index] ?? 0 }))
    .filter((entry) => entry.value !== 0);
  return (
    <div className="min-w-36 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{result.buckets[index]?.title}</p>
      {rows.length === 0 ? <p className="text-ink-2">Nothing</p> : null}
      {rows.map((row) => (
        <p key={row.key} className="flex items-center gap-2 py-0.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ background: row.color }}
          />
          <span className="tabular font-semibold">{formatMoneyRounded(row.value, currency)}</span>
          <span className="truncate text-ink-2">{row.label}</span>
        </p>
      ))}
      {rows.length > 1 ? (
        <p className="tabular mt-1 border-t border-line pt-1 text-ink-2">
          {formatMoneyRounded(result.totals[index] ?? 0, currency)} in total
        </p>
      ) : null}
    </div>
  );
}

/**
 * One segment of a stacked bar: square where it stands on the baseline, rounded at the
 * free end, and 1px short where it touches a neighbour (two of those make the 2px gap).
 */
function Segment({
  x,
  y,
  width,
  height,
  fill,
  negative,
  atBase,
  atTip,
}: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly negative: boolean;
  readonly atBase: boolean;
  readonly atTip: boolean;
}) {
  const insetTip = atTip ? 0 : 1;
  const insetBase = atBase ? 0 : 1;
  const top = Math.min(y, y + height) + (negative ? insetBase : insetTip);
  const size = Math.abs(height) - insetTip - insetBase;
  if (size <= 0 || width <= 0) return <g />;
  const radius = atTip ? Math.min(TIP_RADIUS, width / 2, size) : 0;
  const [left, right, bottom] = [x, x + width, top + size];
  const path = negative
    ? `M${left},${top}H${right}V${bottom - radius}Q${right},${bottom} ${right - radius},${bottom}H${left + radius}Q${left},${bottom} ${left},${bottom - radius}Z`
    : `M${left},${bottom}V${top + radius}Q${left},${top} ${left + radius},${top}H${right - radius}Q${right},${top} ${right},${top + radius}V${bottom}Z`;
  return <path d={path} fill={fill} />;
}

/** Stacked columns over time. With `signColoured`, one series drawn by direction: in or out. */
export function StackedBars({
  result,
  series,
  currency,
  height,
  signColoured = false,
}: ChartProps & { readonly signColoured?: boolean }) {
  const rows = useMemo(() => chartRows(result, series), [result, series]);
  const tick = useAxis(result);
  // Per bucket and side of zero: the series standing on the baseline and the one at the tip.
  const ends = useMemo(
    () =>
      result.buckets.map((_, bucket) => {
        const side = (sign: 1 | -1) =>
          series.flatMap((entry, column) =>
            (entry.values[bucket] ?? 0) * sign > 0 ? [column] : [],
          );
        const [up, down] = [side(1), side(-1)];
        return { base: new Set([up[0], down[0]]), tip: new Set([up.at(-1), down.at(-1)]) };
      }),
    [result.buckets, series],
  );
  const hasNegative = series.some((entry) => entry.values.some((value) => value < 0));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} stackOffset="sign" margin={MARGIN} barCategoryGap="18%">
        {grid}
        {xAxis(tick)}
        {yAxis}
        {hasNegative ? <ReferenceLine y={0} stroke="var(--line-strong)" /> : null}
        <Tooltip
          cursor={{ fill: "var(--wash)" }}
          isAnimationActive={false}
          content={({ active, label }) => (
            <ChartTooltip
              active={active}
              bucket={label}
              result={result}
              series={series}
              currency={currency}
            />
          )}
        />
        {series.map((entry, column) => (
          <Bar
            key={entry.key}
            dataKey={`s_${column}`}
            stackId="stack"
            maxBarSize={24}
            isAnimationActive={false}
            shape={({ x, y, width, height: barHeight, index }: BarShapeProps) => {
              const negative = (entry.values[index] ?? 0) < 0;
              return (
                <Segment
                  x={Number(x)}
                  y={Number(y)}
                  width={Number(width)}
                  height={Number(barHeight)}
                  fill={signColoured && negative ? NEGATIVE_COLOR : entry.color}
                  negative={negative}
                  atBase={ends[index]?.base.has(column) ?? true}
                  atTip={ends[index]?.tip.has(column) ?? true}
                />
              );
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const END_LABEL_LIMIT = 4;
const END_LABEL_CHARS = 14;

/**
 * Whether each line's end can carry its name: at most four lines, and ends far enough
 * apart that the names don't overlap (then the legend alone has to do).
 */
const canLabelEnds = (series: ReadonlyArray<Series>, height: number) => {
  if (series.length < 2 || series.length > END_LABEL_LIMIT) return false;
  const values = series.flatMap((entry) => entry.values);
  const span = Math.max(0, ...values) - Math.min(0, ...values);
  if (span === 0) return false;
  const ends = series.map((entry) => entry.values.at(-1) ?? 0).toSorted((a, b) => a - b);
  // A line of 11px text needs about 14px to itself.
  return ends.every(
    (value, index) => index === 0 || ((value - (ends[index - 1] ?? 0)) / span) * height >= 14,
  );
};

const endLabel = (label: string) =>
  label.length > END_LABEL_CHARS ? `${label.slice(0, END_LABEL_CHARS - 1)}…` : label;

/** One line per series; the crosshair finds the bucket, so nobody has to hit a 2px line. */
export function Lines({ result, series, currency, height }: ChartProps) {
  const rows = useMemo(() => chartRows(result, series), [result, series]);
  const tick = useAxis(result);
  const last = rows.length - 1;
  const hasNegative = series.some((entry) => entry.values.some((value) => value < 0));
  const labelEnds = canLabelEnds(series, height);
  const margin = labelEnds
    ? {
        ...MARGIN,
        // Room for the longest name, at roughly 6px a character.
        right: 16 + 6 * Math.max(...series.map((entry) => endLabel(entry.label).length)),
      }
    : MARGIN;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={margin}>
        {grid}
        {xAxis(tick)}
        {yAxis}
        {hasNegative ? <ReferenceLine y={0} stroke="var(--line-strong)" /> : null}
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          isAnimationActive={false}
          content={({ active, label }) => (
            <ChartTooltip
              active={active}
              bucket={label}
              result={result}
              series={series}
              currency={currency}
            />
          )}
        />
        {series.map((entry, column) => (
          <Line
            key={entry.key}
            dataKey={`s_${column}`}
            type="linear"
            stroke={entry.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            // Only the end of each line is marked, ringed so it stays clear where lines cross.
            dot={({ cx: dotX, cy: dotY, index }) =>
              index === last ? (
                <g key={index}>
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r={4}
                    fill={entry.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                  {labelEnds ? (
                    <text
                      x={Number(dotX) + 9}
                      y={Number(dotY) + 4}
                      fontSize={11}
                      fill="var(--ink-2)"
                    >
                      {endLabel(entry.label)}
                    </text>
                  ) : null}
                </g>
              ) : (
                <g key={index} />
              )
            }
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Names the series. Not shown for a single one: the title already says what it is. */
export function Legend({
  series,
  mark,
}: {
  readonly series: ReadonlyArray<ChartSeries>;
  readonly mark: "bar" | "line";
}) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {series.map((entry) => (
        <li key={entry.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={mark === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]"}
            style={{ background: entry.color }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The period's totals, largest first: one bar per group on a shared baseline, in one
 * colour. Length already says "bigger"; a colour per bar would say nothing more.
 */
export function RankedBars({
  result,
  currency,
}: {
  readonly result: Aggregate;
  readonly currency: string;
}) {
  const largest = Math.max(1, ...result.series.map((entry) => Math.abs(entry.total)));
  const whole = result.series.reduce((sum, entry) => sum + Math.max(0, entry.total), 0);
  return (
    <ol className="flex flex-col gap-2.5">
      {result.series.map((entry) => (
        <li
          key={entry.key}
          className="grid grid-cols-[minmax(5rem,10rem)_minmax(2rem,1fr)_auto] items-center gap-3 text-sm"
        >
          <span className="truncate text-ink-2" title={entry.label}>
            {entry.label}
          </span>
          <span className="block h-3.5">
            <span
              className="block h-full min-w-0.5 rounded-r-[4px]"
              style={{
                width: `${(Math.abs(entry.total) / largest) * 100}%`,
                background: entry.total < 0 ? NEGATIVE_COLOR : "var(--series-1)",
              }}
            />
          </span>
          <span className="tabular text-right">
            <span className="font-medium">{formatMoneyRounded(entry.total, currency)}</span>
            {whole > 0 && entry.total > 0 ? (
              <span className="ml-2 inline-block w-9 text-xs text-ink-2">
                {Math.round((entry.total / whole) * 100)}%
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

const cell = "px-2.5 py-1.5 text-right whitespace-nowrap";
const sticky = "sticky left-0 bg-surface px-2.5 py-1.5 text-left";

/** Groups down, time across, totals on both edges. Also every chart's table twin. */
export function PivotTable({
  result,
  currency,
  groupLabel,
}: {
  readonly result: Aggregate;
  readonly currency: string;
  readonly groupLabel: string;
}) {
  const money = (value: number): ReactNode =>
    value === 0 ? <span className="text-muted">–</span> : formatMoneyRounded(value, currency);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="tabular w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong text-xs text-ink-2">
            <th scope="col" className={cx(sticky, "font-medium")}>
              {groupLabel}
            </th>
            {result.buckets.map((bucket) => (
              <th
                key={bucket.key}
                scope="col"
                title={bucket.title}
                className={cx(cell, "font-medium")}
              >
                {bucket.label}
              </th>
            ))}
            <th scope="col" className={cx(cell, "font-medium")}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {result.series.map((entry) => (
            <tr key={entry.key} className="border-b border-line hover:bg-wash">
              <th scope="row" className={cx(sticky, "max-w-48 truncate font-normal")}>
                {entry.label}
              </th>
              {entry.values.map((value, index) => (
                <td key={result.buckets[index]?.key} className={cell}>
                  {money(value)}
                </td>
              ))}
              <td className={cx(cell, "font-medium")}>{money(entry.total)}</td>
            </tr>
          ))}
        </tbody>
        {result.series.length > 1 ? (
          <tfoot>
            <tr className="font-medium">
              <th scope="row" className={sticky}>
                Total
              </th>
              {result.totals.map((value, index) => (
                <td key={result.buckets[index]?.key} className={cell}>
                  {money(value)}
                </td>
              ))}
              <td className={cell}>{money(result.total)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
