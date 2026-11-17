import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { deleteView, saveView } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { MEASURE_LABELS, OWNER_LABELS } from "#/domain/aggregate";
import { PERIOD_LABELS, today } from "#/domain/dates";
import {
  CHARTS,
  GROUPINGS,
  INTERVALS,
  LIMITS,
  MEASURES,
  OWNERS,
  PERIOD_PRESETS,
  type ViewConfig,
  type ViewInput,
} from "#/domain/model";
import { formatMoneyRounded } from "#/domain/money";
import {
  Button,
  Card,
  Checkbox,
  Field,
  PageHeader,
  Segmented,
  Select,
  TextInput,
} from "#/ui/controls";
import { CHART_LABELS, describeView, GROUP_LABELS, INTERVAL_LABELS } from "./labels";
import { useViewData } from "./useViewData";
import { ViewBody } from "./ViewBody";

export const NEW_VIEW: ViewInput = {
  name: "",
  config: {
    chart: "bar",
    measure: "spending",
    groupBy: "category",
    period: { preset: "last-12-months" },
    interval: "month",
    owners: ["mine", "shared"],
    splitShared: false,
    accountIds: null,
    categoryIds: null,
  },
};

const options = <T extends string>(values: ReadonlyArray<T>, labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

/** "All of them", or a ticked subset. `null` is all, so things added later are included. */
function Subset({
  label,
  all,
  items,
  selected,
  onChange,
}: {
  readonly label: string;
  readonly all: string;
  readonly items: ReadonlyArray<{ readonly id: number; readonly name: string }>;
  readonly selected: ReadonlyArray<number> | null;
  readonly onChange: (selected: ReadonlyArray<number> | null) => void;
}) {
  // A view can still list something that was deleted since; only what exists is offered.
  const known = new Set(items.map((item) => item.id));
  const chosen = new Set(selected?.filter((id) => known.has(id)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium text-ink-2">{label}</legend>
      <Checkbox
        label={all}
        checked={selected === null}
        onChange={(event) => onChange(event.target.checked ? null : items.map((item) => item.id))}
      />
      {selected === null ? null : (
        <div className="flex gap-1.5">
          <Button small onClick={() => onChange(items.map((item) => item.id))}>
            Tick all
          </Button>
          <Button small onClick={() => onChange([])}>
            Untick all
          </Button>
        </div>
      )}
      {selected === null ? null : (
        <div className="grid max-h-56 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-md border border-line p-2.5">
          {items.map((item) => (
            <Checkbox
              key={item.id}
              label={item.name}
              checked={chosen.has(item.id)}
              onChange={(event) =>
                onChange(
                  items
                    .filter((other) =>
                      other.id === item.id ? event.target.checked : chosen.has(other.id),
                    )
                    .map((other) => other.id),
                )
              }
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

/** Builds or changes a view. The drawing on the right follows every change at once. */
export function ViewEditor({
  viewId,
  initial,
}: {
  readonly viewId?: number;
  readonly initial: ViewInput;
}) {
  const { accounts, categories, settings } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState(initial.name);
  const [config, setConfig] = useState(initial.config);
  const [asTable, setAsTable] = useState(false);
  const data = useViewData(config);
  const set = (change: Partial<ViewConfig>) => setConfig((current) => ({ ...current, ...change }));

  const save = useLedgerMutation(saveView, ["workspace"]);
  const remove = useLedgerMutation(deleteView, ["workspace"]);
  const busy = save.isPending || remove.isPending;
  const title = name.trim() === "" ? "Untitled view" : name.trim();

  const onSave = (copy: boolean) =>
    save.mutate(
      {
        data: {
          ...(viewId === undefined || copy ? {} : { id: viewId }),
          name: (copy ? `${title} (copy)` : title).slice(0, LIMITS.name),
          config,
        },
      },
      {
        onSuccess: (saved) =>
          copy
            ? navigate({ to: "/views/$viewId", params: { viewId: String(saved.id) } })
            : navigate({ to: "/" }),
      },
    );

  const custom = config.period.preset === "custom" ? config.period : null;

  return (
    <>
      <PageHeader
        title={viewId === undefined ? "New view" : "Edit view"}
        description="Changes show on the right as you make them. Nothing is saved until you save."
        actions={
          <>
            {viewId === undefined ? null : (
              <>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete the view "${title}"?`)) return;
                    remove.mutate(
                      { data: { id: viewId } },
                      { onSuccess: () => navigate({ to: "/" }) },
                    );
                  }}
                >
                  Delete
                </Button>
                <Button disabled={busy} onClick={() => onSave(true)}>
                  Save as copy
                </Button>
              </>
            )}
            <Button disabled={busy} onClick={() => navigate({ to: "/" })}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => onSave(false)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4 p-4">
          <Group title="View">
            <Field label="Name">
              <TextInput
                value={name}
                maxLength={LIMITS.name}
                placeholder="Untitled view"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Segmented
              label="Show as"
              value={config.chart}
              options={options(CHARTS, CHART_LABELS)}
              onChange={(chart) => set({ chart })}
            />
          </Group>

          <Group title="What to count">
            <Segmented
              label="Measure"
              value={config.measure}
              options={options(MEASURES, MEASURE_LABELS)}
              onChange={(measure) => set({ measure })}
            />
            <Field label="Split by">
              <Select
                value={config.groupBy}
                onChange={(event) =>
                  set({ groupBy: GROUPINGS.find((value) => value === event.target.value) })
                }
              >
                {GROUPINGS.map((value) => (
                  <option key={value} value={value}>
                    {GROUP_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </Group>

          <Group title="Time">
            <Field label="Period">
              <Select
                value={config.period.preset}
                onChange={(event) => {
                  const preset = PERIOD_PRESETS.find((value) => value === event.target.value);
                  const now = today();
                  set({
                    period:
                      preset === undefined
                        ? { preset: "custom", from: `${now.slice(0, 4)}-01-01`, to: now }
                        : { preset },
                  });
                }}
              >
                {PERIOD_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {PERIOD_LABELS[preset]}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </Select>
            </Field>
            {custom === null ? null : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">
                  <TextInput
                    type="date"
                    value={custom.from}
                    onChange={(event) =>
                      event.target.value === ""
                        ? undefined
                        : set({ period: { ...custom, from: event.target.value } })
                    }
                  />
                </Field>
                <Field label="To">
                  <TextInput
                    type="date"
                    value={custom.to}
                    onChange={(event) =>
                      event.target.value === ""
                        ? undefined
                        : set({ period: { ...custom, to: event.target.value } })
                    }
                  />
                </Field>
              </div>
            )}
            {config.chart === "breakdown" ? null : (
              <Segmented
                label="One column per"
                value={config.interval}
                options={options(INTERVALS, INTERVAL_LABELS)}
                onChange={(interval) => set({ interval })}
              />
            )}
          </Group>

          <Group title="Whose money">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {OWNERS.map((owner) => (
                <Checkbox
                  key={owner}
                  label={OWNER_LABELS[owner]}
                  checked={config.owners.includes(owner)}
                  onChange={(event) =>
                    set({
                      owners: OWNERS.filter((other) =>
                        other === owner ? event.target.checked : config.owners.includes(other),
                      ),
                    })
                  }
                />
              ))}
            </div>
            <Checkbox
              label="Count only my share of shared transactions"
              hint={`My share is ${settings.sharePercent}% (change it in Settings).`}
              checked={config.splitShared}
              onChange={(event) => set({ splitShared: event.target.checked })}
            />
          </Group>

          <Group title="Only some of it">
            <Subset
              label="Accounts"
              all="All accounts"
              items={accounts}
              selected={config.accountIds}
              onChange={(accountIds) => set({ accountIds })}
            />
            <Subset
              label="Categories"
              all="All categories"
              items={categories}
              selected={config.categoryIds}
              onChange={(categoryIds) => set({ categoryIds })}
            />
          </Group>
        </Card>

        <Card className="min-w-0 p-4 lg:sticky lg:top-16">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{title}</h2>
              <p className="truncate text-xs text-ink-2">{describeView(config)}</p>
            </div>
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
          </header>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {data.result === undefined
              ? "–"
              : formatMoneyRounded(data.result.total, settings.currency)}
          </p>
          <div className="mt-3 min-w-0">
            <ViewBody config={config} asTable={asTable} height={340} {...data} />
          </div>
        </Card>
      </div>
    </>
  );
}
