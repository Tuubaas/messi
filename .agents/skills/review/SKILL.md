---
name: review
description: Review a diff in this repo against the owner's decisions, codified patterns, and the agent decision boundary. Use before handing off any change, when asked to review a PR or branch here, or as the reviewer step of an autonomous run.
---

# Review

Review the target diff (default: current branch vs `main`). Read the changed files in full, not just hunks.

## 1. Gates (run them; any failure is a finding)

```bash
vp check && vp test && vp run -r build
```

The build prerenders the homepage and fails on invalid content.

## 2. Decision boundary (highest severity)

Read `docs/decisions/README.md`. Flag any change that makes an owner decision without a recorded owner decision:

- [ ] content or copy (`apps/*/content/`, user-visible strings beyond plain UI labels)
- [ ] visual design: colors, fonts, type scale, spacing system, imagery, animation (0006)
- [ ] layout, UX or behaviour changes a visitor or the owner would notice
- [ ] new route or page, new markdown component, new dependency
- [ ] architecture, hosting, cost (e.g. needing the Workers paid plan), auth, storage, analytics or tracking
- [ ] changed or removed behaviour that a decision describes

Fix: revert that part and use `propose-decision`. Never resolve it by choosing.

## 3. Patterns

For every row in `docs/patterns.md` enforced by **review**, check the diff complies. Rows enforced by **lint** are covered by `vp check`. Do not re-review them, but flag any `oxlint-disable` comment.

## 4. Correctness and safety

- [ ] Server functions: auth guard present and meaningful; inputs schema-validated; errors don't leak secrets
- [ ] Secrets are read only via `runtime.server.ts`; nothing secret is in `wrangler.jsonc`, client code, or logs
- [ ] Homepage still ships zero JS: `grep -c "<script" apps/home/dist/client/index.html` → 0 after the build
- [ ] Editor saves still validate with `renderMarkdown` before committing; conflicts never overwrite
- [ ] Finance (`apps/finance`): every server function uses `requireEditor`; no real transactions, account names or amounts in tests, fixtures, logs or error messages (P019)
- [ ] An app that now builds from a new place (outside `apps/<app>/`, `packages/` and the root install files) lists it in `.github/deploy.json`; a new app has an entry there (P023)
- [ ] Tests cover new behaviour through public APIs and layers (no real network)
- [ ] TanStack and Effect usage matches their skills (`pnpm exec intent load ...`, `node_modules/effect/AGENTS.md`)

## 5. Output

List findings, most severe first. For each: file:line, what's wrong, the concrete failure, and the fix. Mark each `fix-now` or `owner-decision`.

## 6. Learn (required)

For each finding ask: could this have been caught mechanically, or will it recur? If yes, run the `codify-pattern` skill in the same change. A finding category raised twice must become a lint rule or a checklist line here.
