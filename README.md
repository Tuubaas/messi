<img src="assets/icon.svg" width="64" height="64" alt="">

# messi

Personal homepage. A static, zero-JavaScript page built with TanStack Start on Cloudflare Workers. The content is markdown in [`content/home.md`](content/home.md), edited at `/edit`.

- How it works and the rules for agents: [AGENTS.md](AGENTS.md)
- Decisions (binding): [docs/decisions](docs/decisions/)
- One-time setup: [docs/setup.md](docs/setup.md)

```bash
vp install
vp dev          # http://localhost:3000, editor at /edit (in-memory, no auth)
vp check && vp test && vp build
```

Created in [T3 Code](https://t3.codes).
