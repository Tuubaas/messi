# One-time setup

Everything here is free. Do it once. The owner runs these steps, because they need the owner's accounts.

## 1. GitHub

1. Create the public repo and push `main`.
2. Create a **fine-grained personal access token**: only this repository, permission **Contents: Read and write**. The editor uses it to commit `content/home.md`.
3. Configure the deploy workflow (Settings → Secrets and variables → Actions):
   - Secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with the "Edit Cloudflare Workers" template.
   - Variable `CLOUDFLARE_ACCOUNT_ID`. Deploys are skipped until this is set.
4. Optional: protect `main` with a ruleset that requires PRs and passing CI, with yourself (repo admin) as a bypass actor, so the editor's token can still commit content.
5. Create a label `content-approved`. Only you add it, to let a PR change `content/`.

## 2. Cloudflare Worker

1. `vp install`, then `pnpm exec wrangler login` and `pnpm run deploy` once. This creates the `messi` Worker at `https://messi.<your-subdomain>.workers.dev`.
2. Set the Worker secrets (`pnpm exec wrangler secret put <NAME>`):

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

Note: Access on `/_serverFn` also covers any public server functions added later. Decide how to split them when that happens.

## 4. Check it

- Open `/edit`, sign in, change something, Save. The status shows a commit link, and the Actions "Deploy" run finishes in about 1–2 minutes.
- Open `/` in a private window: your change is live, and the page loads no JavaScript.
