# One-time setup

Everything here is free. Do it once. The owner runs these steps, because they need the owner's accounts.

## 1. GitHub

1. Create the public repo and push `main`.
2. Create a **fine-grained personal access token**: only this repository, permission **Contents: Read and write**. The editor uses it to commit `apps/home/content/home.md`.
3. Configure the deploy workflow (Settings → Secrets and variables → Actions):
   - Secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with the "Edit Cloudflare Workers" template.
   - Variable `CLOUDFLARE_ACCOUNT_ID`. Deploys are skipped until this is set.
4. Optional: protect `main` with a ruleset that requires PRs and passing CI, with yourself (repo admin) as a bypass actor, so the editor's token can still commit content.
5. Create a label `content-approved`. Only you add it, to let a PR change `apps/*/content/`.

## 2. Cloudflare Worker

1. `vp install` at the repo root. Then, in `apps/home`: `pnpm exec wrangler login` and `pnpm run deploy` once. This creates the `messi` Worker at `https://messi.<your-subdomain>.workers.dev`.
2. Set the Worker secrets (in `apps/home`: `pnpm exec wrangler secret put <NAME>`):

| Secret                  | Value                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `CF_ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com`                                 |
| `CF_ACCESS_AUD`         | Application Audience (AUD) tag from the Access app (step 3)   |
| `EDITOR_EMAIL`          | The email you sign in to Access with; the only allowed editor |
| `GITHUB_REPOSITORY`     | `owner/repo`                                                  |
| `GITHUB_BRANCH`         | `main`                                                        |
| `GITHUB_TOKEN`          | The fine-grained token from step 1.2                          |

## 3. Cloudflare Access (Zero Trust, free)

1. Zero Trust dashboard → Access → Applications → Add → **Self-hosted**.
2. Domain: your Worker hostname. Add two paths: `/edit` and `/_serverFn` (server function calls).
3. Policy: **Allow**, include **Emails** = your email only. Pick a login method (GitHub, Google, or one-time PIN).
4. Copy the **Application Audience (AUD) tag** into the `CF_ACCESS_AUD` secret.

The app verifies the Access JWT itself and also checks `EDITOR_EMAIL`. It fails closed: without these secrets `/edit` errors and nothing can be saved.

Note: Access on `/_serverFn` also covers any public server functions added to the homepage later. Decide how to split them when that happens. (Tubas games has public server functions, so there Access covers only `/admin`; see below.)

## 4. Check it

- Open `/edit`, sign in, change something, Save. The status shows a commit link, and the Actions "Deploy" run finishes in about 1–2 minutes.
- Open `/` in a private window: your change is live, and the page loads no JavaScript.

## Tubas games

The game app in `apps/games` is a second Worker, `tubas-games` (decision 0010). Until these steps are done it still deploys and plays, but its admin stays locked.

### 1. Worker and database

1. In `apps/games`: `pnpm run deploy` once (or let the Deploy workflow do it). This creates the `tubas-games` Worker at `https://tubas-games.<your-subdomain>.workers.dev` **and its D1 database**, also named `tubas-games`. Nothing to create by hand: `wrangler.jsonc` has no database id on purpose, and the table is created on first use. The same deploy creates the Durable Object that runs buzzer rooms (decision 0011); it needs no setup either.
2. The `CLOUDFLARE_API_TOKEN` used by the Deploy workflow needs **D1: Edit** on top of the "Edit Cloudflare Workers" template, so that first deploy can create the database.
3. Set the Worker secrets (in `apps/games`: `pnpm exec wrangler secret put <NAME>`):

| Secret                  | Value                                                          |
| ----------------------- | -------------------------------------------------------------- |
| `CF_ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com`, same as the homepage            |
| `CF_ACCESS_AUD`         | Audience (AUD) tag of the Access application from step 2 below |
| `EDITOR_EMAIL`          | The email you sign in to Access with; the only allowed admin   |

### 2. Cloudflare Access

1. Zero Trust dashboard → Access → Applications → Add → **Self-hosted** (or add the hostname to the homepage's application; then the AUD tag is the same).
2. Domain: the `tubas-games` hostname, path **`/admin`** only. Do **not** add `/_serverFn` here: visitors load boards through it.
3. Leave the application's cookie settings at their defaults. The sign-in cookie must reach `/_serverFn`, so don't enable the cookie **path** attribute.
4. Policy: **Allow**, include **Emails** = your email only.
5. Copy the **Application Audience (AUD) tag** into the `CF_ACCESS_AUD` secret.

Every admin server function verifies the Access token and `EDITOR_EMAIL` itself, so the admin fails closed: with a missing secret or a wrong policy nobody can read drafts or change boards.

### 3. Check it

- Open `/admin`, sign in, press **New board** (or **Start from the sample**), type a clue: the header shows "Saved".
- Publish a board, open `/` in a private window: it is listed and playable. A draft's `/play/<id>` link shows "No such board" there.
- In the private window, `/admin` asks for a sign-in.
- Start a game with **Phones as buzzers**, scan the QR code with a phone, pick a team, open a clue and press the button: the big screen shows who buzzed.
