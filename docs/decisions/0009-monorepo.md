# 0009: Monorepo, homepage in apps/home

- Decided by: owner (structure); agent (tooling and layout defaults below)
- Date: 2026-11-17

## Decision

- **The repo is a monorepo.** The homepage app lives in `apps/home`.

## Agent defaults

The owner can overrule any of these.

| Default                                                                                                                        | Why                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| No extra monorepo tool (no Turborepo or Nx): pnpm workspaces plus Vite+ (`vp run -r`, `--filter`, task caching, root lint/fmt) | Vite+ is already the toolchain (0002) and covers workspace tasks; no new dependency       |
| Layout: `apps/*` deployable apps, `packages/*` shared libraries, `tools/*` repo tooling                                        | The layout `vp create vite:monorepo` generates                                            |
| Root `vite.config.ts` owns lint, format, test projects and task caching; app configs only build their app                      | Vite+ applies root lint/fmt everywhere and ignores package-level blocks in `vp check`     |
| Package names `@messi/home`, `@messi/lint`; custom lint rules are the `tools/lint` package                                     | Lint rules are repo-wide, and get their own tests and dependencies                        |
| TanStack Intent runs from the root                                                                                             | It finds skills in every workspace package, so `pnpm exec intent load ...` works anywhere |
| Deploy still runs on every push to `main`, with no path filter                                                                 | Only one app; avoids a missed path skipping a content deploy                              |

## Consequences

- Owner content moves to `apps/home/content/home.md`. The editor commits there, and the CI content guard watches `apps/*/content/`.
- A new app goes in `apps/<name>`. Adding one is a new page or product, so it is the owner's decision.
