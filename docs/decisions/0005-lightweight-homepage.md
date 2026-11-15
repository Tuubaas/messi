# 0005: Static homepage with zero JavaScript

- Decided by: owner (an "incredibly lightweight, static page")
- Date: 2026-11-15

## Decision

The homepage is prerendered at build time and must stay incredibly lightweight.

The agent implemented this as **zero JavaScript**: the route sets `headers: noJavaScript` and `src/server.ts` strips every script and module preload. The current page is about 0.6 KB of HTML plus 5 KB of CSS. The owner may revisit the zero-JS part, for example if they want an interactive component.

## Consequences

- Components on the homepage render as static HTML only; client interactivity won't work there.
- A future interactive component needs an owner decision on shipping JS. The likely route is TanStack Start `<Hydrate>` islands or server components.
