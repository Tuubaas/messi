import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button, buttonClass } from "./Button";
import { LogoMark } from "./Logo";

/** A full-page message: nothing found, something broke, or still loading. */
export function Notice({
  title,
  children,
  actions,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <main className="stage grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex max-w-md animate-rise flex-col items-center">
        <LogoMark className="size-14" />
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-balance">{title}</h1>
        {children === undefined ? null : (
          <p className="mt-3 text-lg text-pretty text-ink-300">{children}</p>
        )}
        {actions === undefined ? null : (
          <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
        )}
      </div>
    </main>
  );
}

const homeLink = (
  <Link to="/" className={buttonClass({ variant: "primary" })}>
    All boards
  </Link>
);

export function NotFoundPage() {
  return (
    <Notice title="Nothing here" actions={homeLink}>
      This page doesn't exist, or the board was taken down.
    </Notice>
  );
}

export function RouteError() {
  const router = useRouter();
  return (
    <Notice
      title="That didn't work"
      actions={
        <>
          <Button variant="primary" onClick={() => void router.invalidate()}>
            Try again
          </Button>
          <Link to="/" className={buttonClass()}>
            All boards
          </Link>
        </>
      }
    >
      Something went wrong while loading this page.
    </Notice>
  );
}

/** Shown while a page's data is on its way. */
export function PagePending() {
  return (
    <main className="stage grid min-h-dvh place-items-center" aria-busy="true">
      <LogoMark className="size-14 animate-pulse" />
    </main>
  );
}
