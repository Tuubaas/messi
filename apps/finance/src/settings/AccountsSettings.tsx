import { useState } from "react";
import { deleteAccount, saveAccount } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { type Account, type AccountInput, LIMITS } from "#/domain/model";
import { Button, Card, Checkbox, EmptyState, Field, Segmented, TextInput } from "#/ui/controls";
import { Dialog } from "#/ui/Dialog";

const KINDS = [
  { value: "credit", label: "Credit card" },
  { value: "debit", label: "Bank account" },
] as const;

const BLANK: AccountInput = { name: "", institution: "", kind: "credit", shared: false };

function AccountForm({
  account,
  onClose,
}: {
  readonly account: Account | undefined;
  readonly onClose: () => void;
}) {
  const [draft, setDraft] = useState<AccountInput>(account ?? BLANK);
  const save = useLedgerMutation(saveAccount, ["workspace", "transactions"]);
  const set = (change: Partial<AccountInput>) => setDraft((current) => ({ ...current, ...change }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(
          {
            data: {
              ...(account === undefined ? {} : { id: account.id }),
              name: draft.name.trim(),
              institution: draft.institution.trim(),
              kind: draft.kind,
              shared: draft.shared,
            },
          },
          { onSuccess: onClose },
        );
      }}
    >
      <Field label="Name">
        <TextInput
          required
          value={draft.name}
          maxLength={LIMITS.name}
          placeholder="Joint Mastercard"
          onChange={(event) => set({ name: event.target.value })}
        />
      </Field>
      <Field label="Bank or card issuer">
        <TextInput
          value={draft.institution}
          maxLength={LIMITS.name}
          onChange={(event) => set({ institution: event.target.value })}
        />
      </Field>
      <Segmented
        label="Kind"
        value={draft.kind}
        options={KINDS}
        onChange={(kind) => set({ kind })}
      />
      <Checkbox
        label="Shared with my partner"
        hint="Each transaction on a shared account is shared, mine or my partner's. They start as shared; change single ones in Transactions, or whole shops with a rule. On an account that isn't shared, everything is mine."
        checked={draft.shared}
        onChange={(event) => set({ shared: event.target.checked })}
      />
      {account?.shared === true && !draft.shared ? (
        <p className="text-sm text-danger">
          Saving makes every transaction on this account mine again, including the ones you assigned
          by hand.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          disabled={save.isPending || draft.name.trim() === ""}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/** The cards and bank accounts transactions are imported for, and which of them are shared. */
export function AccountsSettings() {
  const { accounts } = useWorkspace();
  // `null` is closed; `"new"` adds one.
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const remove = useLedgerMutation(deleteAccount, ["workspace", "transactions", "imports"]);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          One entry per card or bank account you import transactions for.
        </p>
        <Button variant="primary" onClick={() => setEditing("new")}>
          Add account
        </Button>
      </div>
      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet">
          Add the cards and accounts whose transactions you want to follow. Mark the ones you share
          with your partner.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="truncate text-xs text-ink-2">
                  {[
                    account.kind === "credit" ? "Credit card" : "Bank account",
                    account.institution,
                    account.mapping === null ? null : "file format saved",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span
                className={
                  account.shared
                    ? "rounded-full bg-wash px-2 py-0.5 text-xs font-medium"
                    : "px-2 text-xs text-ink-2"
                }
              >
                {account.shared ? "Shared" : "Only mine"}
              </span>
              <Button small onClick={() => setEditing(account)}>
                Edit
              </Button>
              <Button
                small
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${account.name}" together with all its transactions? This cannot be undone.`,
                    )
                  ) {
                    remove.mutate({ data: { id: account.id } });
                  }
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </Card>
      )}
      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add account" : "Edit account"}
        onClose={() => setEditing(null)}
      >
        {editing === null ? null : (
          <AccountForm
            key={editing === "new" ? "new" : editing.id}
            account={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
