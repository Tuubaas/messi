# 0011: Phones as buzzers in Tubas games

- Decided by: owner (buzzers; the host creates a game that the others connect to; several games at once, two or three at most; buzzing must be fair and not depend much on network latency); agent (everything else below)
- Date: 2026-11-17

## Decision

- Players can **buzz in from their phones**. The host creates a game and the others connect to it.
- **Several games can run at the same time.** Load is small: two or three games.
- **Buzzing is fair**: who gets to answer should depend on who pressed first, not on whose network is faster.

This replaces the "one shared screen, no phones" default of 0010. Playing without phones is still there, as a choice when setting up a game.

## How buzzing is made fair

A buzz counts from **when the button was pressed**, not from when the message reached the server.

1. **Every screen keeps its clock in step with the game's.** A phone sends its own time, the room answers with the room's time, and the phone assumes the message took as long there as back (the way network time works). It does this a few times when it connects and again when a clue comes up, and trusts the quickest exchange. On a home network that is accurate to a few milliseconds.
2. **A buzz carries the time of the press**, translated to the room's clock. The time is taken from the touch event itself (`pointerdown`), so a busy phone doesn't lose time between the finger landing and the code running.
3. **The room waits before naming a winner**, just long enough that no earlier press can still be on its way: each phone reports its measured round trip, and the room waits that long (plus 25 ms) for every phone it hasn't heard from. On home Wi-Fi that is about 50 ms; it never exceeds 400 ms. Then the earliest press wins.
4. **A phone is only believed as far as its connection explains.** A press time is never accepted as older than that phone's own latency allowance, nor as later than its arrival. So a tampered phone can gain at most what a slow connection would legitimately cost it.

What this does not fix: differences between phones' touchscreens (a few milliseconds). Players who watch over a video call see the big screen late; the clue on their own phone arrives on time, so they should read it there.

## Agent defaults

The owner can overrule any of these.

### Product and behaviour

| Default                                                                                                                                                                                                                                                   | Why                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Setting up a game offers **Phones as buzzers** (now the default) or **Call it out** (0010's way: the host decides who was first)                                                                                                                          | Buzzers need everyone to have a phone and a connection; the old way must keep working                        |
| The host's screen shows a **four-letter code and a QR code**. Players scan it or type the code at `/join`. No accounts, nothing to install                                                                                                                | Fastest way into a game from a sofa                                                                          |
| **The host makes the teams, players pick theirs** and give a name. Several phones can share a team; the team's earliest press counts. A team without a phone can still be judged by hand                                                                  | Smallest change from 0010, and teams of any size work                                                        |
| When a team buzzes, the host's screen shows who, and the host answers **Right** or **Wrong** (keys `Y` / `N`). Wrong: that team is out for this clue and the buzzers reopen for the rest. **Wave off** ignores a buzz                                     | Mirrors how the round already worked by hand                                                                 |
| Buzzers open **as soon as the clue is on screen**. Optional per game: **the host opens them** (key `B`), and pressing before that locks the team out for 250 ms                                                                                           | The first is simplest; the second is the quiz-show rule for hosts who read the clue out first                |
| The button never moves: the clue takes the space above it and shrinks its type for long clues (a 400-character clue fits without scrolling on a small phone; sideways, the clue sits beside the button)                                                   | A thumb resting on the button must stay on it from clue to clue                                              |
| The edge of the clue lights up the instant the buzzers open                                                                                                                                                                                               | One signal that everyone in the room sees at the same moment                                                 |
| A phone shows its team, the score and a big button, with **the clue that is on the big screen above the button**, for anyone who prefers to read it there (owner, 2026-11-17). Only the open clue is sent, for as long as it is open, and never an answer | Reading on the phone is a choice everyone has; clues that haven't come up and all answers stay with the host |
| Phones reconnect by themselves and come back as the same player on the same team. Latecomers can join mid-game                                                                                                                                            | Phones sleep and Wi-Fi drops                                                                                 |
| The host can remove a player. Up to 60 players in a game                                                                                                                                                                                                  |                                                                                                              |
| A bell sounds on the host's screen when someone buzzes; it can be muted in the game menu                                                                                                                                                                  | The room notices a buzz without looking                                                                      |
| "Change teams" ends the game for the phones. A game nobody hosts for 12 hours is deleted                                                                                                                                                                  | Rooms shouldn't pile up                                                                                      |

### Architecture

| Default                                                                                                                                                                                                            | Why                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **One Cloudflare Durable Object per game**, reached over WebSockets at `/rooms/<code>/socket`. This is the site's first Durable Object                                                                             | A game needs one place that sees every buzz in order. Durable Objects are that, are on the free plan, and each game gets its own |
| The object is SQLite-backed and uses hibernating WebSockets with automatic ping replies                                                                                                                            | The free plan only allows SQLite-backed objects, and a hibernating room with idle phones costs nothing                           |
| **The game still lives in the host's browser** (0010). The room only knows the teams, the players, the scores to show, the clue that is up and who buzzed. The host's browser tells it again after every reconnect | Keeps one owner of the game's rules, and a reload of any screen recovers by itself                                               |
| Whoever creates a game holds a random key in their browser; only that key can run the room. A code already in use is simply swapped for another                                                                    | No accounts, yet nobody else can take over a game                                                                                |
| The rules are a pure function in `src/buzzer/room.ts`; the Durable Object only connects them to sockets, storage and the clock                                                                                     | The fairness rules can be tested exactly, without a network                                                                      |
| New dependency: `uqr`, to draw the QR code                                                                                                                                                                         | Small, no dependencies of its own; writing a QR encoder by hand isn't worth it                                                   |

## Consequences

- Nothing to set up: the Durable Object is created by `wrangler deploy` from `wrangler.jsonc`.
- Cost stays free. The free plan allows 100,000 Durable Object requests and 13,000 GB-seconds a day, and counts 20 incoming WebSocket messages as one request ([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). A three-hour game with ten phones uses well under one percent of either. If a limit is ever hit, buzzing stops working until midnight UTC; games without phones are unaffected.
- Anyone can create a room, as anyone can play a published board. Rooms hold no personal data beyond the names players type, and delete themselves.
- Likely next questions for the owner: showing the answer on the phones once it is revealed, players creating their own teams, more than six teams.
