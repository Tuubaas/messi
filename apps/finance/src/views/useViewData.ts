import { useMemo } from "react";
import { useTransactions, useWorkspace } from "#/api/queries";
import { aggregate } from "#/domain/aggregate";
import { resolvePeriod, today } from "#/domain/dates";
import type { ViewConfig } from "#/domain/model";

/** Loads the transactions a view covers and works out what it shows. */
export const useViewData = (config: ViewConfig) => {
  const { categories, accounts, settings, span } = useWorkspace();
  const now = today();
  const range = resolvePeriod(config.period, now, span ?? { from: now, to: now });
  const { transactions, isFetching, error } = useTransactions(range);
  const result = useMemo(
    () =>
      transactions === undefined
        ? undefined
        : aggregate(transactions, config, {
            categories,
            accounts,
            sharePercent: settings.sharePercent,
            today: now,
          }),
    [transactions, config, categories, accounts, settings.sharePercent, now],
  );
  return { result, isFetching, error };
};
