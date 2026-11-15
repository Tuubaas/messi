---
name: propose-decision
description: Escalate a product decision to the site's owner instead of making it. Use whenever work in this repo touches content, design, UX, new pages or components, dependencies, architecture, hosting or cost, auth, storage, or anything public-facing without an existing owner decision in docs/decisions.
---

# Propose a decision

The owner decides product (decision 0001). Your job is to make their choice fast and informed, never to make it for them.

## 1. Check it isn't decided

Search `docs/decisions/` and `docs/decisions/proposed/`. If it's decided, follow the decision. If a proposal already exists, add to it instead of duplicating.

## 2. Write `docs/decisions/proposed/<short-slug>.md`

```markdown
# Proposed: <question as the owner would ask it>

- Raised by: agent, <date>
- Blocks: <what work waits on this>

## Context

<2–4 sentences: what you were doing, why it needs a decision, relevant constraints (free hosting, zero-JS homepage, design pending…)>

## Options

1. **<name>**: what it means for the site, tradeoffs, cost, effort.
2. **<name>**: …
   (2–4 real options. Include "don't do it" when that's viable.)

## Recommendation

<one option and why, in one or two sentences>
```

Verify facts (limits, prices, API support) instead of guessing, and cite where they came from.

## 3. Hand off

- Commit the proposal on its own branch and open a PR titled `decision: <question>` with the label `decision-needed`. Don't implement any option in that PR.
- Continue other work that doesn't depend on the answer.

## 4. When the owner answers

Move the file to `docs/decisions/NNNN-<slug>.md` (next number). Rewrite it as a decision: `Decided by: owner`, the date, what was decided and its consequences. Update the table in `docs/decisions/README.md`, then implement it. If the decision implies a checkable pattern, run `codify-pattern`.
