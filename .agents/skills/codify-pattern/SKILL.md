---
name: codify-pattern
description: Turn an identified right or wrong way of writing code in this repo into an enforced rule, preferably a lint rule and otherwise a review-skill check, and refine the review skill when it missed something. Use when a review finds a recurring issue, the owner corrects a pattern, or an agent discovers a convention worth enforcing.
---

# Codify a pattern

Decision 0007: every identified pattern gets enforced. Keep each rule small, explained, and tested.

## 1. Pin down the pattern

Write one sentence each: **the rule**, **why**, and **where it came from** (decision number, review finding, or owner correction). If the "why" is a product preference rather than code quality, it needs an owner decision first (`propose-decision`).

## 2. Choose the enforcement (in this order)

1. **Types**: make the wrong code not compile, e.g. a typed registry or branded type. Strongest; no rule needed.
2. **Built-in Oxlint rule**: check `vp lint --rules` for an existing rule (eslint, typescript, react, unicorn, import, node, jsdoc, promise, vitest…). Configure it in the `lint` block of `vite.config.ts`, with `overrides` for file-scoped rules.
3. **Custom rule** in `lint/messi.ts`:
   - Import the API from `vite-plus/lint/plugins` (never `oxlint`/`@oxlint/plugins`).
   - `meta.docs.description` states the rule; the message says how to fix it.
   - Add valid and invalid cases to `lint/messi.test.ts` with `RuleTester`, including the near-miss that must stay valid.
   - Enable it as `"messi/<rule>": "error"` in `vite.config.ts`.
4. **Review check**: only if it needs judgment. Add one checklist line to `.agents/skills/review/SKILL.md` under the matching section.

## 3. Apply and record

- Run `vp check` and fix every existing violation in the same change; don't suppress them.
- Add a row to `docs/patterns.md` with the next P-number, the pattern, why, what enforces it, and the origin.
- If a review missed this and someone else caught it later, also tighten the review skill so it would have caught it, and say so in the PR.

## 4. Verify

`vp check && vp test`. A rule that never fires on the bad example is not done.
