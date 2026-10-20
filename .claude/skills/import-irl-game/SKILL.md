---
name: import-irl-game
description: Record an in-person (IRL) spades game from a photo of a paper scoresheet into the production database (game_results + round_bids) so it counts in player stats. Use when the user shares a scoresheet photo or asks to add, import or insert a manually scored game.
---

# Import an in-person game

The pipeline: **photo → transcribed JSON → generated SQL → the user runs it against
prod with `psql`**. Claude has no prod credentials. The user runs the SQL themselves
and pastes the output back.

The generator is `apps/server/src/scripts/irl-game-sql.ts`. It validates the
transcription, replays it through the shared scoring code, compares the result with
the totals written on the paper, and emits a self-checking transactional SQL script.

## 1. Read the sheet

- Photos are 3024×4032. Crop to read faint pencil:
  `sips -c <height> <width> --cropOffset <y> <x> in.jpeg --out <scratchpad>/crop.jpg`.
  The arguments are **height-first and y-first**. Swapping them crops the wrong region.
- When the game was played: the sheet may say (e.g. "8:40p end"). Otherwise use
  `sips -g creation <photo>`, the local time the photo was taken. Use Eastern time
  (`-04:00` during DST, `-05:00` otherwise).
- Layout seen so far: team initials as column headers (e.g. `B+J`), then per round a
  bid line `x+y` and a running total. Newer sheets also have per-player tricks
  `(a+b)` and the round's points in parentheses. **The order inside `x+y` matches the
  order of the initials in the header.**
- `Ø` is a nil, but on the 2026-10-16 sheet it was a **blind** nil. Only the arithmetic
  tells you which: a made nil is +100 and a made blind nil is +200.

## 2. Transcribe to JSON

Write the JSON to the scratchpad, **never into the repo**. The repo is public and the
file holds friends' email addresses. Format (see `example-game.json` alongside this
file):

- `roomId`: `IRL-YYYYMMDD`, the date played. Add a suffix (`IRL-20261017-2`) for a
  second game on the same day.
- `playedAt`: ISO timestamp with an offset.
- `team1` / `team2`: initials. Seats are `team1[0]`=0, `team2[0]`=1, `team1[1]`=2,
  `team2[1]`=3.
- `players`: initial → `users.email`. Get the emails from memory, or have the user run
  `SELECT display_name, email FROM users;`. Prod display names are first names only,
  which is why matching is by email.
- `rounds[].play`: initial → `[bid, tricks]`. The bid is 1–13, `"nil"` or `"blind"`.
- `rounds[].paper`: the running totals written after that round, `[team1, team2]`.
  Use `null` for an unreadable cell. Always include these, because they are the main
  check on the transcription.

## 3. Generate and reconcile

```bash
pnpm --filter @spades/server irl-game-sql <abs path>/game.json > <abs path>/game.sql
```

Use absolute paths, because `pnpm --filter` runs from `apps/server`. The score table
goes to stderr. If the replay disagrees with `paper`, the script exits 1.

How to resolve a mismatch:

- **Use the arithmetic to read ambiguous digits.** Scores pin the tricks down tightly.
  The ones digit of a running total is the team's bag count, because a bag is worth 1
  point and penalties are multiples of 100. And `points = 10×bid + bags`, plus or minus
  100/200 per nil. On the 10/17 sheet a smudged 5-or-6 was settled this way.
- **A sheet that is actually wrong** (e.g. 14 tricks in a round) has no correct
  transcription. Show the user the options and their effect on the final score, and let
  them choose. Then pass `--allow-paper-mismatch` and record the correction in a
  comment in the JSON or SQL. Never adjust it silently.
- **No per-player tricks on the sheet** (older format): team totals can be worked out
  from the scores, but each player's share can't. Ask the user. The precedent
  (2026-10-16) is to give each player their bid and split the bags as evenly as
  possible. Record in memory that the game's per-player tricks are invented.

## 4. Optional local dry run

The generated SQL is covered by the `irl-game-sql script` block in
`apps/server/src/db/__tests__/game-results.integration.test.ts`. To run one specific
script against a throwaway database, start Postgres in Docker (see "Database
Integration Tests" in CLAUDE.md), run `createTables()` once, seed four `users` rows
with the same emails, and `psql -v ON_ERROR_STOP=1 -f game.sql`. Docker Desktop may be
quit when you start, so stop the container afterwards.

## 5. The user runs it in prod

Ask the user to copy **spades-db → Connect → External Database URL** from the Render
dashboard (the Internal one only works inside Render), then run:

```
! psql "<External Database URL>" -v ON_ERROR_STOP=1 -f <abs path>/game.sql
```

Mention that the `!` form puts the password in the transcript, and that running it in
a separate terminal and pasting the output back avoids that.

Success looks like: the preview lists exactly 4 users, then `INSERT 0 1`,
`INSERT 0 <4×rounds>`, `NOTICE: OK: replayed finals X / Y`, `COMMIT`. On any failure
the whole transaction is discarded, so nothing is written. The script refuses to run a
second time for the same `roomId`.

## 6. Afterwards

Update the in-person game memory note (`project_irl_game_import.md`) with the new
`roomId`, the result, and whether its per-player tricks are real or invented.
Analytics must leave games with invented per-player tricks out of individual stats.
