import { Link, linkOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Notices } from "./notices";

const pages = linkOptions([
  { to: "/", label: "Overview", activeOptions: { exact: true } },
  { to: "/transactions", label: "Transactions" },
  { to: "/import", label: "Import" },
  { to: "/settings", label: "Settings" },
]);

/** The frame around every page: the name, the four places to go, and notices. */
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 px-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Finance
          </Link>
          <nav aria-label="Pages" className="flex min-w-0 gap-1 overflow-x-auto">
            {pages.map(({ label, ...link }) => (
              <Link
                key={link.to}
                {...link}
                className="rounded-md px-2.5 py-1 text-sm text-ink-2 hover:bg-wash hover:text-ink"
                activeProps={{ className: "bg-wash font-medium !text-ink" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <Notices />
    </>
  );
}
