import type { ReactNode } from "react";

/** A key cap, for shortcut hints. Hidden on touch screens, where there is no keyboard. */
export function Kbd({ children }: { readonly children: ReactNode }) {
  return (
    <kbd className="hidden rounded-md bg-black/20 px-1.5 py-0.5 font-sans text-[0.7em] font-bold tracking-wide opacity-75 ring-1 ring-inset ring-current/25 [@media(hover:hover)]:inline-block">
      {children}
    </kbd>
  );
}
