import type { ImportRow, Owner, Transaction } from "./model";

/**
 * How transactions travel. Reading: the database hands out JSON text (see
 * `Ledger.transactionsJson`) which only the browser parses. Writing: an upload is numbered
 * here so that the server can tell a repeated line from a second identical purchase.
 */

type TransactionTuple = readonly [
  id: number,
  accountId: number,
  date: string,
  amount: number,
  description: string,
  categoryId: number | null,
  categoryManual: number,
  owner: Owner,
  ownerManual: number,
  note: string,
];

/** Newest first, as every list shows them. */
export const decodeTransactions = (json: string): Array<Transaction> =>
  // The text comes from our own database through our own server function.
  (JSON.parse(json) as ReadonlyArray<TransactionTuple>)
    .map(
      ([
        id,
        accountId,
        date,
        amount,
        description,
        categoryId,
        categoryManual,
        owner,
        ownerManual,
        note,
      ]) => ({
        id,
        accountId,
        date,
        amount,
        description,
        categoryId,
        categoryManual: categoryManual === 1,
        owner,
        ownerManual: ownerManual === 1,
        note,
      }),
    )
    .toSorted((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));

/**
 * Numbers identical lines of one file (same day, amount and description): 0, 1, 2… Two
 * coffees on one day are two transactions; the same file uploaded twice is not.
 */
export const withSequence = <R extends ImportRow>(
  rows: ReadonlyArray<R>,
): Array<R & { readonly seq: number }> => {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = `${row.date}\u0000${row.amount}\u0000${row.description}`;
    const seq = seen.get(key) ?? 0;
    seen.set(key, seq + 1);
    return { ...row, seq };
  });
};

/** Splits an upload into requests small enough for the server to check quickly. */
export const chunks = <A>(items: ReadonlyArray<A>, size: number): Array<ReadonlyArray<A>> =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
