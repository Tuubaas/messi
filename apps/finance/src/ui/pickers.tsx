import type { SelectHTMLAttributes } from "react";
import { OWNER_LABELS } from "#/domain/aggregate";
import {
  CATEGORY_KINDS,
  type Category,
  type CategoryKind,
  OWNERS,
  type Owner,
} from "#/domain/model";
import { Select } from "./controls";

export const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Expenses",
  income: "Income",
  transfer: "Transfers",
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  readonly small?: boolean;
};

/** Picks a category, grouped by kind. The empty choice is named by the caller. */
export function CategorySelect({
  categories,
  value,
  onChange,
  none,
  ...props
}: SelectProps & {
  readonly categories: ReadonlyArray<Category>;
  readonly value: number | null;
  readonly onChange: (categoryId: number | null) => void;
  /** What "no category" is called here: "Uncategorised", "Don't change"… */
  readonly none: string;
}) {
  return (
    <Select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      {...props}
    >
      <option value="">{none}</option>
      {CATEGORY_KINDS.map((kind) => (
        <optgroup key={kind} label={KIND_LABELS[kind]}>
          {categories
            .filter((category) => category.kind === kind)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** Picks whose money it is. With `none`, also "no choice". */
export function OwnerSelect({
  value,
  onChange,
  none,
  ...props
}: SelectProps & {
  readonly value: Owner | null;
  readonly onChange: (owner: Owner | null) => void;
  readonly none?: string;
}) {
  return (
    <Select
      value={value ?? ""}
      onChange={(event) => onChange(OWNERS.find((owner) => owner === event.target.value) ?? null)}
      {...props}
    >
      {none === undefined ? null : <option value="">{none}</option>}
      {OWNERS.map((owner) => (
        <option key={owner} value={owner}>
          {OWNER_LABELS[owner]}
        </option>
      ))}
    </Select>
  );
}
