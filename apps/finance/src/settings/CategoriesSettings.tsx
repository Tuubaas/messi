import { useState } from "react";
import { deleteCategory, reorderCategories, saveCategory } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { CATEGORY_KINDS, type Category, type CategoryKind, LIMITS } from "#/domain/model";
import { Button, Card, Field, Select, TextInput } from "#/ui/controls";
import { Dialog } from "#/ui/Dialog";
import { KIND_LABELS } from "#/ui/pickers";

const KIND_HINTS: Record<CategoryKind, string> = {
  expense: "Counts as spending.",
  income: "Counts as income.",
  transfer: "Counts as neither: card payments, savings, money between your own accounts.",
};

function CategoryForm({
  category,
  onClose,
}: {
  readonly category: Category | undefined;
  readonly onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? "expense");
  const save = useLedgerMutation(saveCategory, ["workspace"]);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(
          {
            data: {
              ...(category === undefined ? {} : { id: category.id }),
              name: name.trim(),
              kind,
            },
          },
          { onSuccess: onClose },
        );
      }}
    >
      <Field label="Name">
        <TextInput
          required
          value={name}
          maxLength={LIMITS.name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Kind" hint={KIND_HINTS[kind]}>
        <Select
          value={kind}
          onChange={(event) =>
            setKind(CATEGORY_KINDS.find((value) => value === event.target.value) ?? "expense")
          }
        >
          {CATEGORY_KINDS.map((value) => (
            <option key={value} value={value}>
              {KIND_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={save.isPending || name.trim() === ""}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/** The set of categories. Their order here is their order everywhere, charts included. */
export function CategoriesSettings() {
  const { categories } = useWorkspace();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const reorder = useLedgerMutation(reorderCategories, ["workspace"]);
  const remove = useLedgerMutation(deleteCategory, ["workspace", "transactions"]);

  const move = (index: number, by: -1 | 1) => {
    const ids = categories.map((category) => category.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + by, 0, moved);
    reorder.mutate({ data: { ids } });
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          What transactions are sorted into. Transfers count as neither spending nor income.
        </p>
        <Button variant="primary" onClick={() => setEditing("new")}>
          Add category
        </Button>
      </div>
      <Card className="divide-y divide-line">
        {categories.map((category, index) => (
          <div key={category.id} className="flex items-center gap-3 px-4 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</p>
            <span className="w-20 text-xs text-ink-2">{KIND_LABELS[category.kind]}</span>
            <Button
              small
              variant="ghost"
              aria-label={`Move ${category.name} up`}
              disabled={index === 0 || reorder.isPending}
              onClick={() => move(index, -1)}
            >
              ↑
            </Button>
            <Button
              small
              variant="ghost"
              aria-label={`Move ${category.name} down`}
              disabled={index === categories.length - 1 || reorder.isPending}
              onClick={() => move(index, 1)}
            >
              ↓
            </Button>
            <Button small onClick={() => setEditing(category)}>
              Edit
            </Button>
            <Button
              small
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${category.name}"? Its transactions become uncategorised, and rules that only set this category are removed.`,
                  )
                ) {
                  remove.mutate({ data: { id: category.id } });
                }
              }}
            >
              Delete
            </Button>
          </div>
        ))}
      </Card>
      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add category" : "Edit category"}
        onClose={() => setEditing(null)}
      >
        {editing === null ? null : (
          <CategoryForm
            key={editing === "new" ? "new" : editing.id}
            category={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
