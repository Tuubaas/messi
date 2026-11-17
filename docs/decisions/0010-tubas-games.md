# 0010: Tubas games, a quiz-board game app in apps/games

- Decided by: owner (the app, its name, the 5×5 board, an admin view and a play view, "UI and UX is of very high importance"); agent (everything else below)
- Date: 2026-11-17

## Decision

- **A second app, "Tubas games", lives in `apps/games`** (`@messi/games`), deployed as its own Worker.
- It is a quiz-board game: a **5×5 grid** of clues, five categories by five point values.
- It has a **play view** and an **admin view**. In the admin, boards can be **created and edited**.
- UI and UX matter most.

The owner asked the agent to fill in the rest and said they will change what they don't agree with. So every row below is an agent default, open to being overruled.

## Agent defaults

### Product and behaviour

| Default                                                                                                                                                                                                   | Why                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **One shared screen, run by a host.** Teams answer out loud; the host opens clues, shows answers and marks teams right or wrong. ~~No phones as buzzers~~ (buzzers were added in [0011](0011-buzzers.md)) | It is how a quiz board is played at a party, and it needs no realtime backend                                        |
| Routes: `/` lists published boards, `/play/$boardId` plays one, `/admin` lists all boards, `/admin/$boardId` edits one                                                                                    | The smallest set that gives a play view and an admin view                                                            |
| 1–6 teams, each with a name and one of six colours. Team names are remembered for next time                                                                                                               | A regular group shouldn't retype names                                                                               |
| Right answer: plus the clue's value. Wrong answer: minus the value, switchable off per game ("Wrong answers lose points", on by default). At most one team is right per clue                              | The classic rule, with the casual variant one switch away                                                            |
| The team that answered right last "picks" next (shown on the scoreboard). Nothing enforces it                                                                                                             | Helps the host keep track without getting in the way                                                                 |
| A clue counts as played once its answer was shown or a team was judged. Opening and closing it untouched leaves it on the board. A played clue can be reopened, corrected or put back                     | Mistakes happen live; everything is undoable                                                                         |
| Scores can also be corrected by hand in the game menu, in steps of the smallest clue value                                                                                                                | For disputes and house rules                                                                                         |
| The game ends when the last clue closes (or from the menu), with final standings                                                                                                                          |                                                                                                                      |
| **A game lives in the browser** (`localStorage`), per board. Reloading resumes it; the front page shows "in progress"                                                                                     | The screen everyone looks at _is_ the game; nothing to sync                                                          |
| Text-only clues. No images, audio, timers, wager clues or final round                                                                                                                                     | Kept the first version small; each is an owner decision to add                                                       |
| Boards are **drafts until published**. Only published boards are listed and playable by visitors; the admin can play a draft to preview it. Publishing needs a complete board                             | Lets a board stay secret until game night, and keeps half-written boards off the front page                          |
| Point values are per row and editable (default 100–500). Limits: title 80, category 48, clue 400, answer 200 characters                                                                                   | Covers 200–1000 style boards; limits keep clues readable on a TV                                                     |
| The editor **saves by itself** shortly after typing stops, and before leaving the page                                                                                                                    | No save button to forget                                                                                             |
| A sample board (placeholder trivia written by the agent) is seeded in local development and offered as "Start from the sample" when the admin has no boards                                               | Something to play and to learn the editor from; it is not owner content and is never created in production by itself |
| UI copy is the agent's placeholder wording, in English                                                                                                                                                    | The owner can reword any of it                                                                                       |

### Design

Decision 0006 (design pending) still holds for the homepage. Tubas games has its own design because the owner asked for high-quality UI here:

| Default                                                                                                                    | Why                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dark only: a plum "stage" with brass for the brand and the point values                                                    | It is shown on TVs in dim rooms; brass because of the tuba. Deliberately its own look, not a TV show's |
| **Colour means a team.** The board is monochrome; a played tile takes the colour of the team that won it                   | The board doubles as a map of who is winning                                                           |
| One typeface: Bricolage Grotesque (variable), self-hosted through `@fontsource-variable/bricolage-grotesque`               | Typography carries the design; self-hosting means no request to a font service                         |
| Sizes scale with the screen, from phone to TV; the play view always fits one screen without scrolling                      |                                                                                                        |
| Motion: the tile grows into the clue (View Transitions), scores count up, confetti at the end. All off with reduced-motion | Makes reveals feel like events                                                                         |
| Icons and the logo (a tuba bell) are small inline SVGs drawn for this app                                                  | No icon dependency                                                                                     |

### Architecture

| Default                                                                                                                                                                               | Why                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Boards are stored in Cloudflare D1** (free plan), one table, a board's clues as one JSON column. This is the first database, which 0003 left to the owner                           | Boards must be editable from anywhere and saved while typing. Git (0004's model) would publish answers in a public repo and take minutes per save. KV's free plan allows only 1,000 writes a day |
| The table is created on first use (`CREATE TABLE IF NOT EXISTS`); no migration tooling yet                                                                                            | A fresh deploy or checkout works without a setup step. Revisit when the schema first changes                                                                                                     |
| `wrangler.jsonc` has no `database_id`: `wrangler deploy` creates the database on the first deploy                                                                                     | No manual resource setup                                                                                                                                                                         |
| The admin is protected like `/edit`: **Cloudflare Access plus the in-app check** of the Access token and `EDITOR_EMAIL`. `EditorAuth` moved to `packages/access` and both apps use it | One implementation of the security-critical part                                                                                                                                                 |
| Access covers only `/admin` on this app, not `/_serverFn`: visitors need the public server functions. Admin server functions verify the Access cookie themselves                      | Resolves the note in `docs/setup.md` for this app                                                                                                                                                |
| Without its Access settings the admin is locked, but published boards still play                                                                                                      | A missing secret shouldn't take the game down                                                                                                                                                    |
| Saves use the board's revision: a save from a stale copy is reported as a conflict, never overwrites                                                                                  | Same rule as content saves (0004)                                                                                                                                                                |
| Pages are rendered by the Worker (as 0003 foresees). `/play/$boardId` loads its data on the server but renders in the browser                                                         | The game state is in the browser, so only the browser can draw the right screen                                                                                                                  |
| Worker name `tubas-games`; dev server on port 3001; deployed when a push to `main` affects it (0009)                                                                                  |                                                                                                                                                                                                  |

## Consequences

- One-time setup for the owner is in [docs/setup.md](../setup.md#tubas-games): three secrets and one Access application path.
- Cost stays free: D1's free plan allows 5 million rows read and 100,000 rows written per day; this app writes one row per save.
- The Workers free plan's 10 ms CPU per request applies to these server-rendered pages. If it is ever hit, routes can be switched to `ssr: false`.
- Likely next questions for the owner: images or audio in clues, a timer, wager clues, a custom domain.
