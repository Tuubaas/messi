# 0001: The owner decides product; agents decide code

- Decided by: owner
- Date: 2026-11-15

## Decision

This is the owner's site, about the owner, and every decision about it is theirs. Agents may build and maintain it on their own, within these limits:

- **Agents decide:** implementation details that follow recorded decisions and lint rules, such as code structure, refactors, tests, bug fixes, tooling, patch and minor dependency updates, and new lint rules.
- **The owner decides:** anything visible, felt or consequential. That means content, copy, visual design, layout, UX and behaviour, new pages, new markdown components, new dependencies, architecture, hosting and cost, auth, storage, analytics, and anything public-facing.

When it's unclear which side something falls on, it's the owner's call.

## Consequences

- Agents escalate with the `propose-decision` skill instead of choosing.
- Agent-chosen defaults are logged (see 0008) so the owner can overrule them.
- `apps/*/content/` is never edited by agents (CI guard on PRs).
