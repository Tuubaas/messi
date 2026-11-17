# 0002: Stack

- Decided by: owner
- Date: 2026-11-15

## Decision

React, TanStack Start, Effect, Tailwind CSS, and Vite+ (`vp`: Vite, Vitest, Oxlint, Oxfmt), plus other tools where they fit.
**Use TanStack features where possible.** Don't rebuild what a TanStack library already does well.

## Consequences

- TanStack Intent skills are mapped in `AGENTS.md`. Agents load them before touching TanStack code.
- Server logic uses Effect services, layers and Schema. Effect 4 also supplies the JWT/JWKS verification and the HTTP client, so there's no extra auth or HTTP library.
- When TanStack lacks a feature we need, write the smallest bridge and say so in a comment. Example: there's no per-route "ship no JavaScript" option yet, hence `apps/home/src/server.ts`.
