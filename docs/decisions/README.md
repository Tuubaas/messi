# Decisions

Binding decisions about this site. **Decided by** says who made the call:

- `owner`: a product decision. Only the owner can change it.
- `agent`: an implementation default an agent chose inside an owner decision. The owner can overrule it at any time. Agents may refine these, but must log any change here.

Open questions for the owner go in [`proposed/`](proposed/) (see the `propose-decision` skill). When the owner answers, move the file here, fill in the decision, and set `Decided by: owner`.

| #                                    | Decision                                                | By    |
| ------------------------------------ | ------------------------------------------------------- | ----- |
| [0001](0001-owner-decides.md)        | The owner decides product; agents decide code           | owner |
| [0002](0002-stack.md)                | React, TanStack Start, Effect, Tailwind, Vite+          | owner |
| [0003](0003-free-hosting.md)         | Free: Cloudflare Workers, public GitHub repo, no DB     | owner |
| [0004](0004-content-editing.md)      | Markdown in git, edited at /edit behind Access          | owner |
| [0005](0005-lightweight-homepage.md) | Static homepage with zero JavaScript                    | owner |
| [0006](0006-design-pending.md)       | Visual design is pending; bare placeholder for now      | owner |
| [0007](0007-codify-patterns.md)      | Every found pattern becomes a lint rule or review check | owner |
| [0008](0008-agent-defaults.md)       | Implementation defaults chosen during setup             | agent |
| [0009](0009-monorepo.md)             | Monorepo; the homepage app lives in `apps/home`         | owner |
| [0010](0010-tubas-games.md)          | Tubas games: quiz-board app in `apps/games`, on D1      | owner |
| [0011](0011-buzzers.md)              | Phones as buzzers, fair by press time; Durable Objects  | owner |
