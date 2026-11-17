import { useState } from "react";
import { deleteRule } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { OWNER_LABELS } from "#/domain/aggregate";
import { Button, Card, EmptyState } from "#/ui/controls";
import { type RuleDraft, RuleDialog } from "#/rules/RuleDialog";

/** Every rule, to review, change or remove. Most are made from a transaction instead. */
export function RulesSettings() {
  const { rules, categories } = useWorkspace();
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const remove = useLedgerMutation(deleteRule, ["workspace", "transactions"]);
  const categoryName = (id: number | null) =>
    id === null ? null : (categories.find((category) => category.id === id)?.name ?? null);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Rules categorise transactions by their description. When several match, the one with the
          longest text wins. What you set by hand is never changed.
        </p>
        <Button
          variant="primary"
          onClick={() => setDraft({ pattern: "", categoryId: null, owner: null })}
        >
          Add rule
        </Button>
      </div>
      {rules.length === 0 ? (
        <EmptyState title="No rules yet">
          Change a transaction's category in Transactions and choose "Apply to all like this": that
          makes a rule, and next month's import is categorised by itself.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="text-ink-2">contains </span>
                <span className="font-medium">{rule.pattern}</span>
              </p>
              <p className="text-sm text-ink-2">
                {[
                  categoryName(rule.categoryId),
                  rule.owner === null ? null : `owner: ${OWNER_LABELS[rule.owner]}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Button small onClick={() => setDraft(rule)}>
                Edit
              </Button>
              <Button
                small
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete the rule for "${rule.pattern}"? What it categorised falls back to other rules, or to uncategorised.`,
                    )
                  ) {
                    remove.mutate({ data: { id: rule.id } });
                  }
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </Card>
      )}
      <RuleDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
