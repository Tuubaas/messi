import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button, buttonClass } from "./controls";

/** A full-area message: nothing found, something broke, or still loading. */
function Message({
  title,
  children,
  actions,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {children === undefined ? null : (
          <p className="mt-2 text-sm text-pretty text-ink-2">{children}</p>
        )}
        {actions === undefined ? null : (
          <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <Message
      title="Nothing here"
      actions={
        <Link to="/" className={buttonClass({ variant: "primary" })}>
          Overview
        </Link>
      }
    >
      This page doesn't exist, or what it showed was deleted.
    </Message>
  );
}

export function RouteError({ error }: { readonly error: unknown }) {
  const router = useRouter();
  return (
    <Message
      title="That didn't work"
      actions={
        <Button variant="primary" onClick={() => void router.invalidate()}>
          Try again
        </Button>
      }
    >
      {error instanceof Error && error.message !== ""
        ? error.message
        : "Something went wrong while loading this page."}
    </Message>
  );
}

/** Shown while a page's data is on its way. */
export function PagePending() {
  return (
    <div className="grid min-h-[60dvh] place-items-center" aria-busy="true">
      <span className="text-sm text-muted">Loading…</span>
    </div>
  );
}
