import { useState } from "react";
import { saveRule } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { matchText, patternMatches } from "#/domain/matching";
import { LIMITS, type Owner, type Transaction } from "#/domain/model";
import { Button, Field, TextInput } from "#/ui/controls";
import { Dialog } from "#/ui/Dialog";
import { CategorySelect, OwnerSelect } from "#/ui/pickers";

export interface RuleDraft {
  readonly id?: number;
  readonly pattern: string;
  readonly categoryId: number | null;
  readonly owner: Owner | null;
}

/**
 * Creates or changes a rule: "descriptions containing this get that category and owner".
 * Saving applies it at once to every matching transaction that wasn't set by hand.
 */
export function RuleDialog({
  draft,
  transactions,
  onClose,
}: {
  /** `null` closes the dialog. */
  readonly draft: RuleDraft | null;
  /** Loaded transactions, to show what the pattern catches. */
  readonly transactions?: ReadonlyArray<Transaction>;
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      open={draft !== null}
      title={draft?.id === undefined ? "New rule" : "Edit rule"}
      onClose={onClose}
    >
      {draft === null ? null : (
        // Keyed so that opening the dialog for another transaction starts a fresh form.
        <RuleForm
          key={`${draft.id}:${draft.pattern}`}
          draft={draft}
          transactions={transactions}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function RuleForm({
  draft,
  transactions,
  onClose,
}: {
  readonly draft: RuleDraft;
  readonly transactions?: ReadonlyArray<Transaction>;
  readonly onClose: () => void;
}) {
  const { categories, accounts } = useWorkspace();
  const [pattern, setPattern] = useState(draft.pattern);
  const [categoryId, setCategoryId] = useState(draft.categoryId);
  const [owner, setOwner] = useState(draft.owner);
  const save = useLedgerMutation(saveRule, ["workspace", "transactions"]);

  const normalised = matchText(pattern);
  const matches =
    transactions === undefined || normalised.length < 2
      ? []
      : transactions.filter((transaction) =>
          patternMatches(normalised, matchText(transaction.description)),
        );
  const examples = [...new Set(matches.map((transaction) => transaction.description))].slice(0, 4);
  const valid = normalised.length >= 2 && (categoryId !== null || owner !== null);
  const hasSharedAccount = accounts.some((account) => account.shared);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        save.mutate(
          {
            data: {
              ...(draft.id === undefined ? {} : { id: draft.id }),
              pattern: normalised,
              categoryId,
              owner,
            },
          },
          { onSuccess: onClose },
        );
      }}
    >
      <Field
        label="When the description contains"
        hint="Upper and lower case don't matter. Shorter text catches more."
      >
        <TextInput
          value={pattern}
          maxLength={LIMITS.pattern}
          onChange={(event) => setPattern(event.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Set the category to">
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            none="Don't set a category"
          />
        </Field>
        <Field
          label="Set the owner to"
          hint={
            hasSharedAccount
              ? "Only matters on shared accounts."
              : "Only matters on shared accounts; you have none yet."
          }
        >
          <OwnerSelect value={owner} onChange={setOwner} none="Don't set an owner" />
        </Field>
      </div>
      {transactions === undefined ? null : (
        <div className="rounded-md bg-sunken px-3 py-2 text-sm">
          <p className="font-medium">
            {matches.length === 0
              ? "No loaded transaction matches."
              : `${matches.length} loaded ${matches.length === 1 ? "transaction matches" : "transactions match"}.`}
          </p>
          {examples.length === 0 ? null : (
            <ul className="mt-1 text-xs text-ink-2">
              {examples.map((example) => (
                <li key={example} className="truncate">
                  {example}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-ink-2">
            Transactions you set by hand keep what you chose. Future imports follow the rule.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!valid || save.isPending}>
          {save.isPending ? "Saving…" : "Save and apply"}
        </Button>
      </div>
    </form>
  );
}
