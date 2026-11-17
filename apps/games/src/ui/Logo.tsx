import { useId } from "react";
import { cx } from "./cx";

/** The bell of a tuba, seen from the front. */
export function LogoMark({ className }: { readonly className?: string }) {
  const brass = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={brass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.93 0.07 95)" />
          <stop offset="1" stopColor="oklch(0.64 0.125 72)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${brass})`} />
      <circle cx="17" cy="17" r="10.5" fill="oklch(0.19 0.035 312)" />
      <circle cx="18" cy="18" r="6.5" fill={`url(#${brass})`} opacity="0.9" />
      <circle cx="19" cy="19" r="3" fill="oklch(0.125 0.022 312)" />
    </svg>
  );
}

export function Logo({ className }: { readonly className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-2.5 font-extrabold tracking-tight", className)}
    >
      <LogoMark className="size-[1.5em]" />
      <span>
        Tubas <span className="text-brass-400">games</span>
      </span>
    </span>
  );
}
