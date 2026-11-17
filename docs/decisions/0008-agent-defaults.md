# 0008: Implementation defaults chosen during setup

- Decided by: agent. The owner can overrule any of these.
- Date: 2026-11-15

| Default                                                                                                             | Why                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Markdown flavour is GitHub-flavored (tables, strikethrough, autolinks)                                              | It matches editing on GitHub as a fallback                                                                               |
| Raw HTML in markdown is dropped                                                                                     | Components are the extension mechanism; this keeps the pipeline safe and lintable                                        |
| Unknown `:text` directives (like `note:this`) render as plain text; unknown `::block` directives are errors         | Prose like "note:this" shouldn't break a save                                                                            |
| Page `<title>` is the first `# heading`                                                                             | No extra frontmatter syntax                                                                                              |
| Links row: GitHub, Email, LinkedIn, X, Bluesky, Website (https only); fixed text labels; author's order; `rel="me"` | Covers common profiles; `rel="me"` enables identity verification                                                         |
| Editor checks the Access email again in the app, not only in the Access policy                                      | Protects against a too-broad Access policy (for example email one-time codes allowed for anyone)                         |
| CSRF protection on all non-GET requests (TanStack `createCsrfMiddleware`)                                           | Server functions are public endpoints                                                                                    |
| `vp run dev` uses an in-memory content store and no auth                                                            | No Access in front of local dev; saves don't commit                                                                      |
| Worker name `messi`, `lang="en"`                                                                                    | Repo name; content language                                                                                              |
| A push to `main` deploys without a separate CI gate (which apps: 0009)                                              | Fastest path to live; the build itself fails on invalid content, and code reaches `main` only through PRs that passed CI |
