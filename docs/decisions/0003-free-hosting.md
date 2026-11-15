# 0003: Free hosting on Cloudflare Workers, public GitHub repo, no database

- Decided by: owner
- Date: 2026-11-15

## Decision

- **Cost: free.** Traffic is very low and content updates happen at most a few times a day.
- **Host: Cloudflare Workers (free plan).** Prerendered pages are served as static assets, which costs no Worker requests or CPU. Future dynamic pages render in the Worker.
- **Repo: public on GitHub.** GitHub Actions minutes are unlimited for public repos.
- **No database initially.** Git is the store for content. A database may come later; that's the owner's decision.

## Consequences

- The Workers free plan allows **10 ms CPU per request**. This matters for future dynamic pages; the paid plan ($5/mo) raises it. Any change that would need the paid plan is the owner's decision.
- Cloudflare Access (Zero Trust free plan, up to 50 users) protects the editor.
