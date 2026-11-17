<img src="assets/icon.svg" width="64" height="64" alt="">

# messi

Personal homepage. A static, zero-JavaScript page built with TanStack Start on Cloudflare Workers. The content is markdown in [`apps/home/content/home.md`](apps/home/content/home.md), edited at `/edit`.

Next to it, [`apps/games`](apps/games/) is **Tubas games**: a 5×5 quiz board for game nights, with a play view for the big screen, phones as buzzers, and an admin for making boards.

A pnpm workspace: apps in [`apps/`](apps/), shared code in [`packages/`](packages/), repo tooling in [`tools/`](tools/).

- How it works and the rules for agents: [AGENTS.md](AGENTS.md)
- Decisions (binding): [docs/decisions](docs/decisions/)
- One-time setup: [docs/setup.md](docs/setup.md)

```bash
vp install
vp run dev        # homepage at http://localhost:3000, editor at /edit (in-memory, no auth)
vp run dev:games  # Tubas games at http://localhost:3001, admin at /admin (local database, no auth)
vp run ready      # check, test and build every package
```

Created in [T3 Code](https://t3.codes).
