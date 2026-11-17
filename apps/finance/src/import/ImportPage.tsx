import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { appendImport, deleteImport, finishImport, startImport } from "#/api/functions";
import { importsQuery, useLedgerMutation, useWorkspace } from "#/api/queries";
import {
  applyMapping,
  columnLabels,
  decodeText,
  detectMapping,
  parseTable,
  type Table,
} from "#/domain/csv";
import { formatDate, today } from "#/domain/dates";
import { type Account, type CsvMapping, type Import, LIMITS } from "#/domain/model";
import { formatMoney } from "#/domain/money";
import { chunks, withSequence } from "#/domain/wire";
import {
  Button,
  buttonClass,
  Card,
  Checkbox,
  EmptyState,
  Field,
  PageHeader,
  Segmented,
  Select,
  TextInput,
} from "#/ui/controls";
import { cx } from "#/ui/cx";

interface LoadedFile {
  readonly name: string;
  readonly table: Table;
}

const DATE_FORMATS = [
  { value: "ymd", label: "Year first (2026-10-31)" },
  { value: "dmy", label: "Day first (31.10.2026)" },
  { value: "mdy", label: "Month first (10/31/2026)" },
] as const;

/** The saved format if it still reads this file, otherwise a fresh guess. */
const mappingFor = (table: Table, account: Account): CsvMapping =>
  account.mapping !== null && applyMapping(table, account.mapping).rows.length > 0
    ? account.mapping
    : detectMapping(table, account.kind);

function ColumnSelect({
  label,
  columns,
  value,
  onChange,
  none,
}: {
  readonly label: string;
  readonly columns: ReadonlyArray<string>;
  readonly value: number | null;
  readonly onChange: (column: number | null) => void;
  readonly none?: string;
}) {
  // A column is its position in the file: two columns can carry the same header.
  const options = columns.map((name, column) => ({ column, name }));
  return (
    <Field label={label}>
      <Select
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      >
        {none === undefined ? null : <option value="">{none}</option>}
        {options.map((option) => (
          <option key={option.column} value={option.column}>
            {option.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Says how the file is read, and lets every guess be corrected. */
function MappingForm({
  table,
  mapping,
  onChange,
  onDetect,
}: {
  readonly table: Table;
  readonly mapping: CsvMapping;
  readonly onChange: (mapping: CsvMapping) => void;
  readonly onDetect: () => void;
}) {
  const columns = columnLabels(table, mapping);
  const set = (change: Partial<CsvMapping>) => onChange({ ...mapping, ...change });
  const [first, second] = mapping.descriptionColumns;
  const amount = mapping.amount;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ColumnSelect
          label="Date column"
          columns={columns}
          value={mapping.dateColumn}
          onChange={(column) => set({ dateColumn: column ?? 0 })}
        />
        <Field label="Dates are written">
          <Select
            value={mapping.dateFormat}
            onChange={(event) =>
              set({
                dateFormat:
                  DATE_FORMATS.find((format) => format.value === event.target.value)?.value ??
                  "ymd",
              })
            }
          >
            {DATE_FORMATS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </Select>
        </Field>
        <ColumnSelect
          label="Description column"
          columns={columns}
          value={first ?? 0}
          onChange={(column) =>
            set({ descriptionColumns: [column ?? 0, ...(second === undefined ? [] : [second])] })
          }
        />
        <ColumnSelect
          label="Add to the description"
          columns={columns}
          value={second ?? null}
          none="Nothing"
          onChange={(column) =>
            set({ descriptionColumns: [first ?? 0, ...(column === null ? [] : [column])] })
          }
        />
      </div>

      <Segmented
        label="Amounts are in"
        value={amount.mode}
        options={[
          { value: "single", label: "One column" },
          { value: "split", label: "One column for money out, one for money in" },
        ]}
        onChange={(mode) =>
          set({
            amount:
              mode === "single"
                ? {
                    mode,
                    column: amount.mode === "split" ? amount.outColumn : amount.column,
                    flipSign: false,
                  }
                : {
                    mode,
                    outColumn: amount.mode === "single" ? amount.column : amount.outColumn,
                    inColumn: amount.mode === "single" ? amount.column : amount.inColumn,
                  },
          })
        }
      />
      {amount.mode === "single" ? (
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <ColumnSelect
            label="Amount column"
            columns={columns}
            value={amount.column}
            onChange={(column) => set({ amount: { ...amount, column: column ?? 0 } })}
          />
          <Checkbox
            className="pb-2"
            label="Purchases are positive numbers in this file"
            hint="Common in card statements. Turns them into money out."
            checked={amount.flipSign}
            onChange={(event) => set({ amount: { ...amount, flipSign: event.target.checked } })}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ColumnSelect
            label="Money out column"
            columns={columns}
            value={amount.outColumn}
            onChange={(column) => set({ amount: { ...amount, outColumn: column ?? 0 } })}
          />
          <ColumnSelect
            label="Money in column"
            columns={columns}
            value={amount.inColumn}
            onChange={(column) => set({ amount: { ...amount, inColumn: column ?? 0 } })}
          />
        </div>
      )}

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
        <Segmented
          label="Decimals are written"
          value={mapping.decimal}
          options={[
            { value: ",", label: "1 234,56" },
            { value: ".", label: "1,234.56" },
          ]}
          onChange={(decimal) => set({ decimal })}
        />
        <Field label="Lines to skip">
          <TextInput
            type="number"
            min={0}
            max={100}
            value={mapping.skipRows}
            onChange={(event) =>
              set({ skipRows: Math.min(100, Math.max(0, Math.trunc(Number(event.target.value)))) })
            }
          />
        </Field>
        <Checkbox
          className="pb-2"
          label="Then a header line"
          checked={mapping.hasHeader}
          onChange={(event) => set({ hasHeader: event.target.checked })}
        />
      </div>
      <div>
        <Button small onClick={onDetect}>
          Guess the format again
        </Button>
      </div>
    </div>
  );
}

const th = "px-2.5 py-1.5 text-left text-xs font-medium text-ink-2";
const td = "px-2.5 py-1.5";

/** What will be imported, before anything is sent. */
function Preview({
  mapped,
  currency,
}: {
  readonly mapped: ReturnType<typeof applyMapping>;
  readonly currency: string;
}) {
  const { rows, skipped } = mapped;
  const dates = rows.map((row) => row.date).toSorted((a, b) => a.localeCompare(b));
  const out = rows.reduce((sum, row) => sum + Math.min(0, row.amount), 0);
  const into = rows.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="font-semibold">
          {rows.length} {rows.length === 1 ? "transaction" : "transactions"}
        </span>
        {rows.length === 0 ? null : (
          <span className="text-ink-2">
            {" · "}
            {formatDate(dates[0] ?? "")} – {formatDate(dates.at(-1) ?? "")}
            {" · out "}
            {formatMoney(out, currency)}
            {" · in "}
            {formatMoney(into, currency)}
          </span>
        )}
      </p>
      {skipped.length === 0 ? null : (
        <p className="text-sm text-ink-2">
          {skipped.length} {skipped.length === 1 ? "line is" : "lines are"} left out:{" "}
          {skipped
            .slice(0, 6)
            .map((line) => `line ${line.line} (${line.reason.toLowerCase()})`)
            .join(", ")}
          {skipped.length > 6 ? "…" : ""}. If these are transactions, the settings above don't fit
          the file yet.
        </p>
      )}
      {rows.length === 0 ? null : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-sunken">
                <th scope="col" className={th}>
                  Date
                </th>
                <th scope="col" className={th}>
                  Description
                </th>
                <th scope="col" className={cx(th, "text-right")}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Numbered like the upload itself, so two identical lines are still two rows. */}
              {withSequence(rows.slice(0, 8)).map((row) => (
                <tr
                  key={`${row.date} ${row.amount} ${row.description} ${row.seq}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className={cx(td, "tabular whitespace-nowrap")}>{formatDate(row.date)}</td>
                  <td className={cx(td, "max-w-80 truncate")}>{row.description}</td>
                  <td
                    className={cx(
                      td,
                      "tabular text-right whitespace-nowrap",
                      row.amount > 0 && "text-positive",
                    )}
                  >
                    {row.amount > 0 ? "+" : ""}
                    {formatMoney(row.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 ? (
            <p className="border-t border-line px-2.5 py-1.5 text-xs text-ink-2">
              and {rows.length - 8} more
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RecentImports() {
  const { accounts } = useWorkspace();
  const { data: imports } = useQuery(importsQuery);
  const undo = useLedgerMutation(deleteImport, ["workspace", "transactions", "imports"]);
  if (imports === undefined || imports.length === 0) return null;
  const accountName = (id: number) =>
    accounts.find((account) => account.id === id)?.name ?? "Deleted account";
  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="mb-2 text-sm font-semibold">Earlier imports</h2>
      <Card className="divide-y divide-line">
        {imports.map((entry: Import) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.filename}</p>
              <p className="truncate text-xs text-ink-2">
                {accountName(entry.accountId)} · {formatDate(today(new Date(entry.createdAt)))} ·{" "}
                {entry.rowCount} lines, {entry.insertedCount} transactions from it
              </p>
            </div>
            <Button
              small
              variant="danger"
              disabled={undo.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Undo the import of "${entry.filename}"? Its ${entry.insertedCount} transactions are deleted, with any changes you made to them.`,
                  )
                ) {
                  undo.mutate({ data: { id: entry.id } });
                }
              }}
            >
              Undo
            </Button>
          </div>
        ))}
      </Card>
    </section>
  );
}

/** Upload a bank's CSV export: pick the account, check how the file is read, import. */
export function ImportPage() {
  const { accounts, settings } = useWorkspace();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const account = accounts.find((candidate) => candidate.id === accountId);

  const mapped = useMemo(
    () => (file === null || mapping === null ? null : applyMapping(file.table, mapping)),
    [file, mapping],
  );

  const upload = useMutation({
    mutationFn: async (input: {
      readonly accountId: number;
      readonly filename: string;
      readonly mapping: CsvMapping;
      readonly rows: ReturnType<typeof applyMapping>["rows"];
    }) => {
      const rows = withSequence(input.rows);
      setProgress(0);
      const importId = await startImport({
        data: {
          accountId: input.accountId,
          filename: input.filename.slice(0, LIMITS.filename),
          rowCount: rows.length,
          mapping: input.mapping,
        },
      });
      let sent = 0;
      for (const part of chunks(rows, LIMITS.importChunk)) {
        await appendImport({ data: { importId, rows: part } });
        sent += part.length;
        setProgress(sent / rows.length);
      }
      return finishImport({ data: { id: importId } });
    },
    // Also after a failure: part of the file may have been stored.
    onSettled: () =>
      Promise.all(
        (["workspace", "transactions", "imports"] as const).map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });

  const onFile = async (chosen: File | undefined) => {
    if (chosen === undefined || account === undefined) return;
    upload.reset();
    const table = parseTable(decodeText(new Uint8Array(await chosen.arrayBuffer())));
    if (table.length === 0) {
      setFile(null);
      setMapping(null);
      setUnreadable(`"${chosen.name}" is empty or not a CSV file.`);
      return;
    }
    setUnreadable(null);
    setFile({ name: chosen.name, table });
    setMapping(mappingFor(table, account));
  };

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Import" />
        <EmptyState
          title="Add an account first"
          action={
            <Link to="/settings" className={buttonClass({ variant: "primary" })}>
              Add an account
            </Link>
          }
        >
          Transactions are imported per card or bank account.
        </EmptyState>
      </>
    );
  }

  const result = upload.data;
  const tooMany = mapped !== null && mapped.rows.length > LIMITS.importRows;

  return (
    <>
      <PageHeader
        title="Import"
        description="Upload the CSV export of one card or account. The file is read in your browser; only the transactions are sent. Importing the same period twice never duplicates anything."
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Account">
            <Select
              value={accountId ?? ""}
              disabled={upload.isPending}
              onChange={(event) => {
                const next = accounts.find(
                  (candidate) => String(candidate.id) === event.target.value,
                );
                setAccountId(next?.id);
                upload.reset();
                if (next !== undefined && file !== null) setMapping(mappingFor(file.table, next));
              }}
            >
              {accounts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.shared ? " (shared)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CSV file">
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              disabled={upload.isPending}
              className="h-9 w-full min-w-0 cursor-pointer rounded-md border border-line-strong bg-surface text-sm file:mr-3 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-line-strong file:bg-sunken file:px-3 file:text-sm file:font-medium file:text-ink"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </Field>
          {unreadable === null ? null : (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {unreadable}
            </p>
          )}
        </Card>

        {file === null || mapping === null || mapped === null || account === undefined ? null : (
          <>
            <Card className="p-4">
              <h2 className="mb-1 text-sm font-semibold">How the file is read</h2>
              <p className="mb-4 text-xs text-ink-2">
                {JSON.stringify(account.mapping) === JSON.stringify(mapping)
                  ? `As saved for ${account.name}.`
                  : "A guess from the file. Correct it if the preview below looks wrong; it is saved for this account."}
              </p>
              <MappingForm
                table={file.table}
                mapping={mapping}
                onChange={(next) => {
                  upload.reset();
                  setMapping(next);
                }}
                onDetect={() => setMapping(detectMapping(file.table, account.kind))}
              />
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Preview</h2>
              <Preview mapped={mapped} currency={settings.currency} />
              {tooMany ? (
                <p role="alert" className="mt-3 text-sm text-danger">
                  That is more than {LIMITS.importRows} transactions. Export a shorter period and
                  import it in parts.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  disabled={
                    mapped.rows.length === 0 || tooMany || upload.isPending || result !== undefined
                  }
                  onClick={() =>
                    upload.mutate({
                      accountId: account.id,
                      filename: file.name,
                      mapping,
                      rows: mapped.rows,
                    })
                  }
                >
                  {upload.isPending
                    ? `Importing… ${Math.round(progress * 100)}%`
                    : `Import into ${account.name}`}
                </Button>
                {result === undefined ? null : (
                  <p role="status" className="text-sm">
                    <span className="font-semibold">
                      {result.insertedCount} new{" "}
                      {result.insertedCount === 1 ? "transaction" : "transactions"}
                    </span>
                    {result.rowCount > result.insertedCount
                      ? `, ${result.rowCount - result.insertedCount} were already there`
                      : ""}
                    .{" "}
                    <Link
                      to="/transactions"
                      search={{ category: "none" }}
                      className="text-accent-ink underline"
                    >
                      Review the uncategorised
                    </Link>
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
      <RecentImports />
    </>
  );
}
