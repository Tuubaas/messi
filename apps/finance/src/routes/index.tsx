import { Link, createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { useMemo } from "react";
import { reorderViews } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { PERIOD_LABELS } from "#/domain/dates";
import { INTERVALS, PERIOD_PRESETS } from "#/domain/model";
import { buttonClass, EmptyState, Field, PageHeader, Select } from "#/ui/controls";
import { INTERVAL_LABELS } from "#/views/labels";
import { ViewCard, type ViewOverride } from "#/views/ViewCard";

/** One period and column width for every view on the page; absent, each keeps its own. */
const Search = Schema.Struct({
  period: Schema.optional(Schema.Literals(PERIOD_PRESETS)),
  interval: Schema.optional(Schema.Literals(INTERVALS)),
});

export const Route = createFileRoute("/")({
  validateSearch: Schema.toStandardSchemaV1(Search),
  component: Overview,
});

function Overview() {
  const { views, span } = useWorkspace();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const reorder = useLedgerMutation(reorderViews, ["workspace"]);

  const override = useMemo(
    (): ViewOverride => ({
      ...(search.period === undefined ? {} : { period: { preset: search.period } }),
      ...(search.interval === undefined ? {} : { interval: search.interval }),
    }),
    [search.period, search.interval],
  );
  const move = (index: number, by: -1 | 1) => {
    const ids = views.map((view) => view.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + by, 0, moved);
    reorder.mutate({ data: { ids } });
  };

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <Link to="/views/new" className={buttonClass({ variant: "primary" })}>
            New view
          </Link>
        }
      />
      {span === null ? (
        <EmptyState
          title="No transactions yet"
          action={
            <>
              <Link to="/settings" className={buttonClass()}>
                Add an account
              </Link>
              <Link to="/import" className={buttonClass({ variant: "primary" })}>
                Import transactions
              </Link>
            </>
          }
        >
          Add your cards and accounts, then upload a CSV export from your bank. The views below fill
          in once there is something to count.
        </EmptyState>
      ) : (
        <>
          {/* One row of filters above everything they change, never one per chart. */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Period" className="w-52">
              <Select
                value={search.period ?? ""}
                onChange={(event) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      period: PERIOD_PRESETS.find((preset) => preset === event.target.value),
                    }),
                    replace: true,
                  })
                }
              >
                <option value="">Each view's own</option>
                {PERIOD_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {PERIOD_LABELS[preset]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="One column per" className="w-40">
              <Select
                value={search.interval ?? ""}
                onChange={(event) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      interval: INTERVALS.find((interval) => interval === event.target.value),
                    }),
                    replace: true,
                  })
                }
              >
                <option value="">Each view's own</option>
                {INTERVALS.map((interval) => (
                  <option key={interval} value={interval}>
                    {INTERVAL_LABELS[interval]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {views.length === 0 ? (
            <EmptyState title="No views">
              A view is one way of looking at your money: a chart or a table, of what you choose.
            </EmptyState>
          ) : (
            <div className="grid grid-flow-row-dense gap-4 lg:grid-cols-2">
              {views.map((view, index) => (
                <ViewCard
                  key={view.id}
                  view={view}
                  override={override}
                  onMove={{
                    ...(index === 0 ? {} : { earlier: () => move(index, -1) }),
                    ...(index === views.length - 1 ? {} : { later: () => move(index, 1) }),
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
