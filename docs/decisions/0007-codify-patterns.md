# 0007: Every found pattern becomes a lint rule or review check

- Decided by: owner
- Date: 2026-11-15

## Decision

Agents will build on this repo on their own. Whenever we find a right or wrong way to write something, it gets codified:

1. **As a lint rule** if it can be checked mechanically. Prefer configuring a built-in Oxlint rule; otherwise write a custom rule in `lint/messi.ts` with RuleTester tests.
2. **As a review check** in `.agents/skills/review/SKILL.md` if it needs judgment.

Every entry is listed in `docs/patterns.md` with its reason and where it came from. Review skills get refined the same way: when a review misses something or the owner corrects one, update the skill.
