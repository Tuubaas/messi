# 0004: Markdown content in git, edited at /edit behind Cloudflare Access

- Decided by: owner
- Date: 2026-11-15

## Decision

- Homepage content is markdown in `content/home.md`. **Git is the single source of truth.**
- The owner edits it at `/edit`: a **textarea with a live preview** rendered by the same pipeline as the homepage.
- `/edit` is protected by **Cloudflare Access**. The owner chose this over a Tailscale-only editor so they can edit from any device at any time without keeping a machine running.
- **Save** validates the content, commits it to `main` through the GitHub API, and the deploy workflow rebuilds the static page. It goes live in about 1–2 minutes, as fast as possible but not instant.
- **Custom components** use markdown directives (`::name{attr="value"}`) backed by a typed registry. Only registered components render, and their attributes are validated with Effect Schema. This was chosen over MDX.
- First component: **links row**, `::links{github="..." email="..."}`.

## Consequences

- Fallback editing: changing `content/home.md` on GitHub (web or mobile) triggers the same rebuild.
- Saves use optimistic concurrency: an edit made elsewhere in the meantime is reported as a conflict and never overwritten.
- Which components exist in the registry is a product decision.
