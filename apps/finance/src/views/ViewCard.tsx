import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWorkspace } from "#/api/queries";
import { formatMoneyRounded } from "#/domain/money";
import type { View, ViewConfig } from "#/domain/model";
import { Button, buttonClass, Card } from "#/ui/controls";
import { cx } from "#/ui/cx";
import { describeView } from "./labels";
import { useViewData } from "./useViewData";
import { ViewBody } from "./ViewBody";

/** Settings the overview can impose on every view at once. */
export type ViewOverride = Partial<Pick<ViewConfig, "period" | "interval">>;

/** One saved view on the overview: its name, what it counts, the total, and the drawing. */
export function ViewCard({
  view,
  override,
  onMove,
}: {
  readonly view: View;
  readonly override: ViewOverride;
  /** Moves the card one place earlier (-1) or later (1); left out at the ends. */
  readonly onMove: { readonly earlier?: () => void; readonly later?: () => void };
}) {
  const { settings } = useWorkspace();
  const config = useMemo(() => ({ ...view.config, ...override }), [view.config, override]);
  const data = useViewData(config);
  const [asTable, setAsTable] = useState(false);
  const edit = { to: "/views/$viewId", params: { viewId: String(view.id) } } as const;

  return (
    <Card
      className={cx("group flex min-w-0 flex-col p-4", config.chart === "table" && "lg:col-span-2")}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            <Link {...edit} className="hover:underline">
              {view.name}
            </Link>
          </h2>
          <p className="truncate text-xs text-ink-2">{describeView(config)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            <Button
              small
              variant="ghost"
              aria-label={`Move ${view.name} earlier`}
              disabled={onMove.earlier === undefined}
              onClick={onMove.earlier}
            >
              ←
            </Button>
            <Button
              small
              variant="ghost"
              aria-label={`Move ${view.name} later`}
              disabled={onMove.later === undefined}
              onClick={onMove.later}
            >
              →
            </Button>
          </span>
          {config.chart === "table" ? null : (
            <Button
              small
              variant="ghost"
              aria-pressed={asTable}
              onClick={() => setAsTable((shown) => !shown)}
            >
              {asTable ? "Chart" : "Table"}
            </Button>
          )}
          <Link {...edit} className={buttonClass({ variant: "ghost", small: true })}>
            Edit
          </Link>
        </div>
      </header>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {data.result === undefined ? "–" : formatMoneyRounded(data.result.total, settings.currency)}
      </p>
      <div className="mt-3 min-w-0">
        <ViewBody config={config} asTable={asTable} {...data} />
      </div>
    </Card>
  );
}
