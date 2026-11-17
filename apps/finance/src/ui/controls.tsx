import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cx } from "./cx";

/** The few controls every page is built from. Plain HTML elements, styled once. */

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

export const buttonClass = ({
  variant = "default",
  small = false,
}: { readonly variant?: ButtonVariant; readonly small?: boolean } = {}) =>
  cx(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    small ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
    variant === "default" && "border border-line-strong bg-surface text-ink hover:bg-wash",
    variant === "primary" && "bg-accent text-on-accent hover:bg-accent-ink",
    variant === "ghost" && "text-ink-2 hover:bg-wash hover:text-ink",
    variant === "danger" && "border border-line-strong bg-surface text-danger hover:bg-wash",
  );

export function Button({
  variant,
  small,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly small?: boolean;
}) {
  return (
    <button type={type} className={cx(buttonClass({ variant, small }), className)} {...props} />
  );
}

const inputClass =
  "h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-muted disabled:opacity-50";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({
  className,
  small = false,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { readonly small?: boolean }) {
  return (
    <select
      className={cx(
        "min-w-0 cursor-pointer rounded-md border border-line-strong bg-surface text-ink disabled:opacity-50",
        small ? "h-7 px-1 text-xs" : "h-9 px-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
}) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-accent" {...props} />
      <span>
        {label}
        {hint === undefined ? null : <span className="block text-xs text-ink-2">{hint}</span>}
      </span>
    </label>
  );
}

/** A labelled control. The label wraps it, so no ids are needed. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint === undefined ? null : <span className="text-xs text-ink-2">{hint}</span>}
    </label>
  );
}

/** One choice out of a few, all visible: chart type, measure, interval. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  readonly onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-xs font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-sunken p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              // `relative` anchors the visually hidden radio to its label (P020).
              "relative flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
              option.value === value
                ? "bg-surface text-ink shadow-sm ring-1 ring-line"
                : "text-ink-2 hover:text-ink",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={label}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Card({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description === undefined ? null : (
          <p className="mt-0.5 text-sm text-ink-2">{description}</p>
        )}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** What a page shows before there is anything to show, with the way forward. */
export function EmptyState({
  title,
  children,
  action,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {children === undefined ? null : (
        <p className="mt-1 max-w-md text-sm text-pretty text-ink-2">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-4 flex gap-2">{action}</div>}
    </div>
  );
}
