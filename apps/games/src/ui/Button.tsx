import type { ComponentProps } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "right" | "wrong";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-brass-300 to-brass-500 text-ink-950 shadow-[inset_0_1px_0_oklch(1_0_0/0.55),0_10px_24px_-10px_oklch(0.76_0.14_80/0.75)] hover:brightness-110",
  secondary:
    "bg-ink-700 text-cream shadow-[inset_0_1px_0_oklch(1_0_0/0.1),inset_0_0_0_1px_oklch(1_0_0/0.06)] hover:bg-ink-600",
  ghost: "text-ink-200 hover:bg-white/8 hover:text-cream",
  danger: "bg-bad/15 text-bad ring-1 ring-inset ring-bad/30 hover:bg-bad/25",
  // The host's two verdicts on an answer.
  right:
    "bg-good text-ink-950 shadow-[inset_0_1px_0_oklch(1_0_0/0.45),0_10px_24px_-10px_var(--color-good)] hover:brightness-110",
  wrong:
    "bg-bad text-ink-950 shadow-[inset_0_1px_0_oklch(1_0_0/0.35),0_10px_24px_-10px_var(--color-bad)] hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-8 text-lg",
};

interface Look {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly className?: string | undefined;
}

/** The button look as a class name, for links that should look like buttons. */
export const buttonClass = ({ variant = "secondary", size = "md", className }: Look = {}) =>
  cx(base, variants[variant], sizes[size], className);

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: Look & ComponentProps<"button">) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

export const iconButtonClass = (className?: string) =>
  cx(
    "grid size-10 flex-none place-items-center rounded-full text-xl text-ink-300 transition duration-150 hover:bg-white/8 hover:text-cream active:scale-95 disabled:pointer-events-none disabled:opacity-40",
    className,
  );

/** A round button showing only an icon; `label` is what it is called. */
export function IconButton({
  icon,
  label,
  className,
  type = "button",
  ...props
}: { readonly icon: IconName; readonly label: string } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClass(className)}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
