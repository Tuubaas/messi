import { Link, getRouteApi } from "@tanstack/react-router";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  type PaginationState,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { type ReactNode, useMemo, useState } from "react";
import { deleteTransactions } from "#/api/functions";
import {
  useLedgerMutation,
  useTransactions,
  useUpdateTransactions,
  useWorkspace,
} from "#/api/queries";
import { formatDate, PERIOD_LABELS, resolvePeriod, today } from "#/domain/dates";
import { matchText, suggestPattern, winningRule } from "#/domain/matching";
import { LIMITS, PERIOD_PRESETS, type Transaction } from "#/domain/model";
import { formatMoney } from "#/domain/money";
import { type RuleDraft, RuleDialog } from "#/rules/RuleDialog";
import { Button, buttonClass, EmptyState, PageHeader, Select, TextInput } from "#/ui/controls";
import { cx } from "#/ui/cx";
import { notify } from "#/ui/notices";
import { CategorySelect, OwnerSelect } from "#/ui/pickers";

const route = getRouteApi("/transactions");

const PAGE_SIZE = 50;
const NONE: ReadonlyArray<Transaction> = [];

// TanStack Table does the sorting, the paging and the selection; the markup is ours.
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

const helper = createColumnHelper<typeof features, Transaction>();

const columns = helper.columns([
  helper.accessor("date", {
    sortFn: (a, b) => a.original.date.localeCompare(b.original.date),
  }),
  helper.accessor("description", {
    sortFn: (a, b) => a.original.description.localeCompare(b.original.description),
  }),
  helper.accessor("amount", { sortFn: (a, b) => a.original.amount - b.original.amount }),
]);

const th = "px-2.5 py-2 text-left text-xs font-medium text-ink-2 whitespace-nowrap";
const td = "px-2.5 py-1.5 align-middle";

/** Every transaction, to search, filter, and put right: category, owner, note. */
export function TransactionsPage() {
  const workspace = useWorkspace();
  const { accounts, categories, rules, settings, span } = workspace;
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const now = today();

  const custom =
    search.from !== undefined && search.to !== undefined
      ? ({ preset: "custom", from: search.from, to: search.to } as const)
      : null;
  const range = resolvePeriod(
    custom ?? { preset: search.period ?? "all" },
    now,
    span ?? { from: now, to: now },
  );
  const { transactions, isFetching, error } = useTransactions(range);

  const needle = matchText(search.q ?? "");
  const filtered = useMemo(
    () =>
      (transactions ?? NONE).filter(
        (transaction) =>
          transaction.date >= range.from &&
          transaction.date <= range.to &&
          (search.account === undefined || transaction.accountId === search.account) &&
          (search.category === undefined ||
            (search.category === "none"
              ? transaction.categoryId === null
              : transaction.categoryId === search.category)) &&
          (search.owner === undefined || transaction.owner === search.owner) &&
          (needle === "" ||
            matchText(`${transaction.description} ${transaction.note}`).includes(needle)),
      ),
    [transactions, range.from, range.to, search.account, search.category, search.owner, needle],
  );

  // Sorting and paging are held here so they can react to the filters.
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  // A new filter or sort order starts at the first page. Reset while rendering, not in an
  // effect, so the old page number is never shown with the new rows.
  const listKey = JSON.stringify([search, range, sorting]);
  const [shownListKey, setShownListKey] = useState(listKey);
  if (shownListKey !== listKey) {
    setShownListKey(listKey);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }
  // An edit or a delete can empty the last page: show the last page that still exists.
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageIndex = Math.min(pagination.pageIndex, Math.max(0, pageCount - 1));

  const table = useTable({
    features,
    columns,
    data: filtered,
    getRowId: (row) => String(row.id),
    state: { sorting, pagination: { ...pagination, pageIndex } },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    enableSortingRemoval: false,
    // An edit replaces the data; the reader must stay on the page they were editing.
    autoResetPageIndex: false,
  });

  const update = useUpdateTransactions();
  const remove = useLedgerMutation(deleteTransactions, ["transactions", "workspace"]);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);

  const categoryRules = useMemo(() => rules.filter((rule) => rule.categoryId !== null), [rules]);
  /** Why a transaction has its category, for the tooltip on the picker. */
  const categoryReason = (transaction: Transaction) => {
    if (transaction.categoryManual) return "Set by hand";
    const rule = winningRule(categoryRules, matchText(transaction.description));
    return rule === undefined ? "No rule matches yet" : `Set by the rule for "${rule.pattern}"`;
  };

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selected = table.getSelectedRowModel().rows.map((row) => row.original.id);

  /** A rule for "everything like this transaction", starting from what a rule for it already says. */
  const draftFor = (
    transaction: Transaction,
    change: Partial<Pick<RuleDraft, "categoryId" | "owner">>,
  ): RuleDraft => {
    const pattern = suggestPattern(transaction.description);
    const existing = rules.find((rule) => rule.pattern === pattern);
    return {
      ...(existing === undefined ? {} : { id: existing.id }),
      pattern,
      categoryId: existing?.categoryId ?? null,
      owner: existing?.owner ?? null,
      ...change,
    };
  };

  /** Offers to turn a one-off change into a rule, without getting in the way. */
  const offerRule = (transaction: Transaction, change: Parameters<typeof draftFor>[1]) =>
    notify({
      tone: "info",
      message: "Changed this transaction.",
      action: {
        label: "Apply to all like this…",
        run: () => setRuleDraft(draftFor(transaction, change)),
      },
    });

  const setSearch = (change: Partial<typeof search>) =>
    void navigate({ search: (previous) => ({ ...previous, ...change }), replace: true });

  const filtering = Object.values(search).some((value) => value !== undefined && value !== "");
  const out = filtered.reduce((sum, row) => sum + Math.min(0, row.amount), 0);
  const into = filtered.reduce((sum, row) => sum + Math.max(0, row.amount), 0);

  const sortHeader = (id: "date" | "description" | "amount", label: string, right = false) => {
    const column = table.getColumn(id);
    const sorted = column?.getIsSorted() ?? false;
    return (
      <th
        scope="col"
        className={cx(th, right && "text-right")}
        aria-sort={sorted === false ? undefined : sorted === "asc" ? "ascending" : "descending"}
      >
        <button
          type="button"
          className="cursor-pointer hover:text-ink"
          onClick={column?.getToggleSortingHandler()}
        >
          {label}
          <span aria-hidden="true" className="ml-1 inline-block w-2">
            {sorted === false ? "" : sorted === "asc" ? "↑" : "↓"}
          </span>
        </button>
      </th>
    );
  };

  let body: ReactNode;
  if (span === null) {
    body = (
      <EmptyState
        title="No transactions yet"
        action={
          <Link to="/import" className={buttonClass({ variant: "primary" })}>
            Import transactions
          </Link>
        }
      >
        Upload a CSV export from your bank to get started.
      </EmptyState>
    );
  } else if (transactions === undefined) {
    body = (
      <p className="py-16 text-center text-sm text-muted">
        {error === null ? "Loading…" : "The transactions could not be loaded."}
      </p>
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState title="Nothing matches">
        No transaction fits these filters in this period.
      </EmptyState>
    );
  } else {
    body = (
      // `relative`: the visually hidden labels inside are absolutely positioned and would
      // otherwise escape this scroll box and make the whole page scroll sideways on a phone.
      <div
        className={cx(
          "relative overflow-x-auto rounded-xl border border-line bg-surface transition-opacity",
          isFetching && "opacity-60",
        )}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className={cx(th, "w-8")}>
                <input
                  type="checkbox"
                  aria-label="Select every transaction on this page"
                  className="size-4 accent-accent"
                  checked={table.getIsAllPageRowsSelected()}
                  ref={(element) => {
                    if (element !== null) {
                      element.indeterminate =
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                    }
                  }}
                  onChange={table.getToggleAllPageRowsSelectedHandler()}
                />
              </th>
              {sortHeader("date", "Date")}
              {sortHeader("description", "Description")}
              <th scope="col" className={th}>
                Account
              </th>
              <th scope="col" className={th}>
                Category
              </th>
              <th scope="col" className={th}>
                Owner
              </th>
              {sortHeader("amount", "Amount", true)}
              <th scope="col" className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const transaction = row.original;
              const account = accountsById.get(transaction.accountId);
              return (
                <tr
                  key={row.id}
                  className={cx(
                    "group border-b border-line last:border-b-0 hover:bg-wash",
                    row.getIsSelected() && "bg-wash",
                  )}
                >
                  <td className={td}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${transaction.description}`}
                      className="size-4 accent-accent"
                      checked={row.getIsSelected()}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </td>
                  <td className={cx(td, "tabular whitespace-nowrap text-ink-2")}>
                    {formatDate(transaction.date)}
                  </td>
                  <td className={cx(td, "w-full max-w-0 min-w-48")}>
                    <p className="truncate" title={transaction.description}>
                      {transaction.description}
                    </p>
                    {transaction.note === "" ? null : (
                      <p className="truncate text-xs text-ink-2">{transaction.note}</p>
                    )}
                  </td>
                  <td className={cx(td, "max-w-40 truncate text-ink-2")}>
                    {account?.name ?? "Deleted account"}
                  </td>
                  <td className={td}>
                    <CategorySelect
                      small
                      className="w-40"
                      aria-label={`Category of ${transaction.description}`}
                      title={categoryReason(transaction)}
                      categories={categories}
                      value={transaction.categoryId}
                      none="Uncategorised"
                      onChange={(categoryId) => {
                        update.mutate({ ids: [transaction.id], categoryId });
                        if (categoryId !== null) offerRule(transaction, { categoryId });
                      }}
                    />
                  </td>
                  <td className={td}>
                    {account?.shared === true ? (
                      <OwnerSelect
                        small
                        className="w-24"
                        aria-label={`Owner of ${transaction.description}`}
                        title={transaction.ownerManual ? "Set by hand" : "Set by a rule or default"}
                        value={transaction.owner}
                        onChange={(owner) => {
                          if (owner === null) return;
                          update.mutate({ ids: [transaction.id], owner });
                          offerRule(transaction, { owner });
                        }}
                      />
                    ) : (
                      <span className="px-1 text-xs text-muted">Mine</span>
                    )}
                  </td>
                  <td
                    className={cx(
                      td,
                      "tabular text-right font-medium whitespace-nowrap",
                      transaction.amount > 0 && "text-positive",
                    )}
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {formatMoney(transaction.amount, settings.currency)}
                  </td>
                  <td className={cx(td, "whitespace-nowrap")}>
                    <span className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                      <Button
                        small
                        variant="ghost"
                        onClick={() =>
                          setRuleDraft(
                            draftFor(
                              transaction,
                              transaction.categoryId === null
                                ? {}
                                : { categoryId: transaction.categoryId },
                            ),
                          )
                        }
                      >
                        Rule
                      </Button>
                      <Button
                        small
                        variant="ghost"
                        onClick={() => {
                          const note = window.prompt("Note for this transaction", transaction.note);
                          if (note !== null) {
                            update.mutate({
                              ids: [transaction.id],
                              note: note.trim().slice(0, LIMITS.note),
                            });
                          }
                        }}
                      >
                        Note
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-sm">
            <span className="text-ink-2">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <span className="flex gap-2">
              <Button small disabled={!table.getCanPreviousPage()} onClick={table.previousPage}>
                Previous
              </Button>
              <Button small disabled={!table.getCanNextPage()} onClick={table.nextPage}>
                Next
              </Button>
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description={
          transactions === undefined || span === null ? undefined : (
            <span className="tabular">
              {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"} · out{" "}
              {formatMoney(out, settings.currency)} · in {formatMoney(into, settings.currency)}
            </span>
          )
        }
      />
      {span === null ? null : (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TextInput
            type="search"
            aria-label="Search descriptions and notes"
            placeholder="Search"
            className="w-56"
            value={search.q ?? ""}
            onChange={(event) =>
              setSearch({ q: event.target.value === "" ? undefined : event.target.value })
            }
          />
          <Select
            aria-label="Period"
            className="w-40"
            value={custom === null ? (search.period ?? "all") : "custom"}
            onChange={(event) => {
              const preset = PERIOD_PRESETS.find((value) => value === event.target.value);
              setSearch(
                preset === undefined
                  ? { period: undefined, from: range.from, to: range.to }
                  : {
                      period: preset === "all" ? undefined : preset,
                      from: undefined,
                      to: undefined,
                    },
              );
            }}
          >
            {PERIOD_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PERIOD_LABELS[preset]}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </Select>
          {custom === null ? null : (
            <>
              <TextInput
                type="date"
                aria-label="From"
                className="w-38"
                value={custom.from}
                onChange={(event) =>
                  event.target.value === "" ? undefined : setSearch({ from: event.target.value })
                }
              />
              <TextInput
                type="date"
                aria-label="To"
                className="w-38"
                value={custom.to}
                onChange={(event) =>
                  event.target.value === "" ? undefined : setSearch({ to: event.target.value })
                }
              />
            </>
          )}
          <Select
            aria-label="Account"
            className="w-44"
            value={search.account ?? ""}
            onChange={(event) =>
              setSearch({
                account: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Category"
            className="w-44"
            value={search.category ?? ""}
            onChange={(event) =>
              setSearch({
                category:
                  event.target.value === ""
                    ? undefined
                    : event.target.value === "none"
                      ? "none"
                      : Number(event.target.value),
              })
            }
          >
            <option value="">All categories</option>
            <option value="none">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <OwnerSelect
            aria-label="Owner"
            className="w-32"
            none="Anyone's"
            value={search.owner ?? null}
            onChange={(owner) => setSearch({ owner: owner ?? undefined })}
          />
          {filtering ? (
            <Button variant="ghost" onClick={() => void navigate({ search: {}, replace: true })}>
              Clear filters
            </Button>
          ) : null}
        </div>
      )}

      {selected.length === 0 ? null : (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-sm">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <CategorySelect
            small
            className="w-44"
            aria-label="Set the category of the selected transactions"
            categories={categories}
            value={null}
            none="Set category…"
            onChange={(categoryId) => {
              if (categoryId !== null) update.mutate({ ids: selected, categoryId });
            }}
          />
          <OwnerSelect
            small
            className="w-36"
            aria-label="Set the owner of the selected transactions"
            value={null}
            none="Set owner…"
            onChange={(owner) => {
              if (owner !== null) update.mutate({ ids: selected, owner });
            }}
          />
          <Button small onClick={() => update.mutate({ ids: selected, categoryId: null })}>
            Uncategorise
          </Button>
          <Button
            small
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Delete ${selected.length} ${selected.length === 1 ? "transaction" : "transactions"}? Importing the same file again brings them back.`,
                )
              ) {
                remove.mutate(
                  { data: { ids: selected } },
                  { onSuccess: () => table.resetRowSelection() },
                );
              }
            }}
          >
            Delete
          </Button>
          <Button small variant="ghost" onClick={() => table.resetRowSelection()}>
            Clear selection
          </Button>
        </div>
      )}

      {body}
      <RuleDialog
        draft={ruleDraft}
        transactions={transactions ?? NONE}
        onClose={() => setRuleDraft(null)}
      />
    </>
  );
}
