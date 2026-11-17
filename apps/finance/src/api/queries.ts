import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueries,
  type UseQueryResult,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { DateRange } from "#/domain/dates";
import type { Owner, Transaction } from "#/domain/model";
import { decodeTransactions } from "#/domain/wire";
import { getWorkspace, listImports, listTransactions, updateTransactions } from "./functions";

/**
 * What the browser keeps of the server: the workspace (accounts, categories, rules,
 * views, settings), the imports, and transactions one calendar year per query, so every
 * view and filter that touches a year shares one download of it.
 */

type CacheKey = "workspace" | "transactions" | "imports";

const FIVE_MINUTES = 5 * 60_000;

export const workspaceQuery = queryOptions({
  queryKey: ["workspace"],
  queryFn: () => getWorkspace(),
  staleTime: FIVE_MINUTES,
});

export const useWorkspace = () => useSuspenseQuery(workspaceQuery).data;

export const importsQuery = queryOptions({
  queryKey: ["imports"],
  queryFn: () => listImports(),
  staleTime: FIVE_MINUTES,
});

const yearQuery = (year: number) =>
  queryOptions({
    queryKey: ["transactions", year],
    queryFn: async () =>
      decodeTransactions(
        await listTransactions({ data: { from: `${year}-01-01`, to: `${year}-12-31` } }),
      ),
    staleTime: FIVE_MINUTES,
  });

/** The calendar years a range touches, newest first. */
const yearsOf = ({ from, to }: DateRange) => {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  return Array.from({ length: Math.max(1, last - first + 1) }, (_, index) => last - index);
};

export interface TransactionsResult {
  /** Newest first; `undefined` until every year of the range has loaded once. */
  readonly transactions: ReadonlyArray<Transaction> | undefined;
  readonly isFetching: boolean;
  readonly error: Error | null;
}

const combine = (
  results: ReadonlyArray<UseQueryResult<Array<Transaction>>>,
): TransactionsResult => ({
  transactions: results.every((result) => result.data !== undefined)
    ? results.flatMap((result) => result.data ?? [])
    : undefined,
  isFetching: results.some((result) => result.isFetching),
  error: results.find((result) => result.error !== null)?.error ?? null,
});

/** Every transaction of the years `range` touches (callers narrow to the exact days). */
export const useTransactions = (range: DateRange): TransactionsResult =>
  useQueries({ queries: yearsOf(range).map(yearQuery), combine });

const invalidate = (queryClient: QueryClient, keys: ReadonlyArray<CacheKey>) =>
  Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

/**
 * A change on the server, after which the listed parts of the cache are fetched again.
 * Failures surface as a notice (see `router.tsx`), so callers only handle success.
 */
export const useLedgerMutation = <Input, Output>(
  mutationFn: (input: Input) => Promise<Output>,
  refresh: ReadonlyArray<CacheKey>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidate(queryClient, refresh),
  });
};

export interface TransactionEdit {
  readonly ids: ReadonlyArray<number>;
  readonly categoryId?: number | null;
  readonly owner?: Owner;
  readonly note?: string;
}

/**
 * Edits transactions and shows the result at once: a category change must feel like
 * ticking a box, not like submitting a form. Put back if the server refuses.
 */
export const useUpdateTransactions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (edit: TransactionEdit) => updateTransactions({ data: edit }),
    onMutate: async (edit) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const previous = queryClient.getQueriesData<Array<Transaction>>({
        queryKey: ["transactions"],
      });
      const ids = new Set(edit.ids);
      // Like the server: only a shared account has owners to change.
      const sharedAccounts = new Set(
        queryClient
          .getQueryData(workspaceQuery.queryKey)
          ?.accounts.filter((account) => account.shared)
          .map((account) => account.id),
      );
      queryClient.setQueriesData<Array<Transaction>>({ queryKey: ["transactions"] }, (rows) =>
        rows?.map((row) => {
          if (!ids.has(row.id)) return row;
          const ownerChanges = edit.owner !== undefined && sharedAccounts.has(row.accountId);
          return {
            ...row,
            ...(edit.categoryId === undefined
              ? {}
              : { categoryId: edit.categoryId, categoryManual: true }),
            ...(ownerChanges && edit.owner !== undefined
              ? { owner: edit.owner, ownerManual: true }
              : {}),
            ...(edit.note === undefined ? {} : { note: edit.note }),
          };
        }),
      );
      return { previous };
    },
    onError: (_error, _edit, context) => {
      for (const [key, rows] of context?.previous ?? []) queryClient.setQueryData(key, rows);
    },
  });
};
