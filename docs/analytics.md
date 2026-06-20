# Spades Analytics

Ad-hoc analysis of completed games, run against the production Postgres DB
(`game_results` + `round_bids`). This document captures both the **analytical
philosophy** (what is and isn't measurable in a team card game) and the
**validated SQL** behind each metric, so we don't re-derive either.

> Status as of 2026-06-19: 9 completed games, 344 bid rows, a closed pool of 4
> players. Sample sizes are small — read every result with that caveat.

---

## Connecting

The DB connection string is **not** committed. Get it from the Render dashboard
(`spades-db` → External Connection) and export it locally:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/DBNAME'   # from Render
psql "$DATABASE_URL" -P pager=off -c "SELECT 1;"
```

All queries below assume `psql "$DATABASE_URL" -P pager=off -c "..."`.

---

## Schema (the parts that matter)

- **`game_results`** — one row per completed game: `room_id`, `team1_score`,
  `team2_score`, `rounds_played`, four nullable player FKs
  (`team1_player1_id`, `team1_player2_id`, `team2_player1_id`,
  `team2_player2_id`), `completed_at`.
- **`round_bids`** — the play-by-play: one row per player per round, with
  `game_result_id`, `round_number`, `player_position` (0–3), `bid`, `is_nil`,
  `is_blind_nil`, `tricks_won`.
- **`users`** — `id`, `display_name`.

**Team / position mapping** (matches the game's own convention):

- `team = player_position % 2` → **team 0 = team1** (positions 0 & 2),
  **team 1 = team2** (positions 1 & 3).
- `game_results.team1_*` columns are positions 0 & 2; `team2_*` are 1 & 3.

---

## Philosophy: what is (and isn't) measurable

This is the most important section. We arrived at it by trying naive
"individual skill" stats and discovering they don't survive scrutiny.

### 1. Spades is a team game — default every metric to the team/partnership level

The atomic unit of success is the **team contract** (combined partnership bid
vs. combined tricks), not the individual bid. Stats belong at the team or
partnership level unless there's a strong reason otherwise.

### 2. Individual bid "accuracy" is not interpretable — do not use it

Comparing a player's own `tricks_won` to their own `bid` looks tempting but is
**meaningless**, and so is any reframing built on it (e.g. a "cover rate" that
credits a player for rescuing a short partner).

**Why:** tricks are a _conserved, team-allocated_ quantity — 13 split among 4
players, and within a team the split is something good partners actively manage
in real time (ducking to dodge bags, routing winners to whoever is short,
throwing the count to set up an endgame). So an individual's
`tricks_won − bid` is the _dependent variable the team optimizes_, not a
measurement of that player.

It's an **identification problem**: from `bid` + `tricks_won` alone, these two
stories are observationally identical —

- Player A overbid, and the partner rescued them, vs.
- The partner underbid, and Player A deliberately ducked tricks to save bags.

— and a good team _deliberately makes them identical_. There is no way to
separate them, so the stat measures routing noise, not skill.

### 3. The one clean individual stat: nil conversion

A nil is a contract held **alone** — "did you take zero tricks" is unambiguous,
and the decision to go nil is purely the player's. So **nil / blind-nil
conversion** is a legitimate individual metric. Caveat: a partner actively helps
cover a nil, so success is partner-_assisted_; and samples are thin.

### 4. The bid number itself is an individual decision — but only describes _style_

The number you declare is your own choice, made on your own hand. Averaged over
many rounds, hand luck washes out, so "avg bid / round" is a fair **style /
aggression** descriptor. Never dress it up as accuracy or skill.

### 5. The only route to an individual _bidding tendency_: large-N, partner-adjusted

You can glimpse whether a player chronically over- or under-bids by treating
them as the **common denominator across many partnerships** (the sabermetric
"with-or-without-you" move): does a given partner's set rate / bag rate rise
specifically when paired with player X versus their other partners?

- Consistently **set → overbidding** (bid more than the hand can deliver).
- Consistently **baggy → underbidding** (left tricks on the table).

Caveats: it's a **latent net estimator** (a chronic overbidder + chronic
underbidder can self-cancel into an accurate team line), and it picks up
non-bidding noise (forced late tricks, card luck). **Our current data cannot
deliver this** — only 9 games, and a _closed 4-player pool_ where everyone only
ever partnered the same three people, so the partners never average out. It's a
long-game framework that becomes trustworthy as the player base and game count
grow.

---

## Scoring reconstruction (reference)

The running-score engine mirrors `packages/shared/src/game-logic/scoring.ts`.
Config (`DEFAULT_GAME_CONFIG` in `packages/shared/src/types/game-state.ts`):
win at **500**, bag threshold **10**, bag penalty **−100**.

Per team-round:

- `reg_bid = SUM(bid)` — nil/blind bids are stored as `bid = 0`, so the sum is
  automatically the non-nil contract.
- `team_tricks = SUM(tricks_won)` — **includes the nil bidder's tricks**, which
  count toward making the contract in this game's rules (not only as bags).
- `nil_bonus` — per nil/blind player: `+100`/`+200` if `tricks_won = 0`, else
  `−100`/`−200` (blind = 200).
- Made (`team_tricks >= reg_bid`):
  `round_points = reg_bid*10 + (team_tricks − reg_bid) + nil_bonus`;
  `round_bags = team_tricks − reg_bid`.
- Set: `round_points = −reg_bid*10 + nil_bonus`; `round_bags = 0`.
- Running score = `cumulative(round_points) − bag_penalty`, where
  **`bag_penalty = FLOOR(cumulative_bags / 10) * 100`**. This invariant holds
  regardless of how bags distribute across rounds (the modulo remainder just
  carries forward), so a running `SUM` of bags computes the penalty exactly.

### ⚠️ Postgres type gotcha (caused a real bug)

`bid` and `tricks_won` are `SMALLINT`. In Postgres, `SUM(smallint)` returns
`bigint`, but **`SUM(bigint)` returns `numeric`**. Because `round_bags` is
itself sum-derived (bigint), `SUM(round_bags) / 10` performs **numeric**
division (`0.9`), not integer division (`0`) — giving a 9-bag team a phantom
90-point penalty. Always wrap the penalty in `FLOOR(... / 10.0)` (or cast).

---

## Queries

### 1. Games where both teams finished over 500

```sql
SELECT id, room_id, team1_score, team2_score, rounds_played, completed_at
FROM game_results
WHERE team1_score > 500 AND team2_score > 500
ORDER BY completed_at DESC;
```

### 2. Resolve player names for a game

```sql
SELECT g.room_id,
       g.team1_score,
       t1p1.display_name AS team1_player1,
       t1p2.display_name AS team1_player2,
       g.team2_score,
       t2p1.display_name AS team2_player1,
       t2p2.display_name AS team2_player2
FROM game_results g
LEFT JOIN users t1p1 ON t1p1.id = g.team1_player1_id
LEFT JOIN users t1p2 ON t1p2.id = g.team1_player2_id
LEFT JOIN users t2p1 ON t2p1.id = g.team2_player1_id
LEFT JOIN users t2p2 ON t2p2.id = g.team2_player2_id
ORDER BY g.completed_at DESC;
```

### 3. Overall win–loss record per player

Unpivots the four player slots, marking each as a win/loss by team score.

```sql
WITH player_games AS (
  SELECT team1_player1_id AS user_id, (team1_score > team2_score) AS won FROM game_results
  UNION ALL
  SELECT team1_player2_id, (team1_score > team2_score) FROM game_results
  UNION ALL
  SELECT team2_player1_id, (team2_score > team1_score) FROM game_results
  UNION ALL
  SELECT team2_player2_id, (team2_score > team1_score) FROM game_results
)
SELECT u.display_name AS player,
       COUNT(*)                                                    AS games,
       COUNT(*) FILTER (WHERE pg.won)                              AS wins,
       COUNT(*) FILTER (WHERE NOT pg.won)                          AS losses,
       ROUND(100.0 * COUNT(*) FILTER (WHERE pg.won) / COUNT(*), 1) AS win_pct
FROM player_games pg
JOIN users u ON u.id = pg.user_id
GROUP BY u.display_name
ORDER BY wins DESC, win_pct DESC;
```

### 4. Set rate & bags by partnership _(the recommended "accuracy" view)_

Per the philosophy, contract accuracy belongs at the partnership level.
`MIN`/`MAX` over the two display names canonicalizes the unordered pair.

```sql
WITH tr AS (
  SELECT rb.game_result_id, rb.round_number, (rb.player_position % 2) AS team,
         MIN(u.display_name) AS p_a,
         MAX(u.display_name) AS p_b,
         SUM(rb.bid)         AS team_bid,
         SUM(rb.tricks_won)  AS team_tricks
  FROM round_bids rb
  JOIN users u ON u.id = rb.player_id
  GROUP BY rb.game_result_id, rb.round_number, (rb.player_position % 2)
)
SELECT p_a || ' & ' || p_b                                           AS partnership,
       COUNT(*)                                                      AS rounds,
       COUNT(*) FILTER (WHERE team_tricks < team_bid)                AS sets,
       ROUND(100.0 * COUNT(*) FILTER (WHERE team_tricks < team_bid)
             / COUNT(*), 1)                                          AS set_pct,
       ROUND(SUM(GREATEST(team_tricks - team_bid, 0))::numeric
             / COUNT(*), 2)                                          AS bags_per_rd
FROM tr
GROUP BY p_a, p_b
ORDER BY set_pct ASC;
```

### 5. Nil conversion per player _(the only clean individual stat)_

```sql
SELECT u.display_name AS player,
       COUNT(*) FILTER (WHERE is_nil OR is_blind_nil)               AS nil_att,
       COUNT(*) FILTER (WHERE (is_nil OR is_blind_nil) AND tricks_won = 0) AS nil_made,
       ROUND(100.0 * COUNT(*) FILTER (WHERE (is_nil OR is_blind_nil) AND tricks_won = 0)
             / NULLIF(COUNT(*) FILTER (WHERE is_nil OR is_blind_nil), 0), 1) AS nil_conv_pct
FROM round_bids rb
JOIN users u ON u.id = rb.player_id
GROUP BY u.display_name
HAVING COUNT(*) FILTER (WHERE is_nil OR is_blind_nil) > 0
ORDER BY nil_conv_pct DESC NULLS LAST;
```

### 6. Score-progression engine + validation

Reconstructs each game's running score round-by-round and checks the final
totals against the stored `game_results` values. All 9 games validate `OK`.

```sql
WITH tr AS (
  SELECT game_result_id, round_number, (player_position % 2) AS team,
    SUM(bid) AS reg_bid, SUM(tricks_won) AS tricks,
    SUM(CASE WHEN (is_nil OR is_blind_nil)
             THEN (CASE WHEN tricks_won = 0 THEN 1 ELSE -1 END)
                  * (CASE WHEN is_blind_nil THEN 200 ELSE 100 END)
             ELSE 0 END) AS nil_bonus
  FROM round_bids
  GROUP BY game_result_id, round_number, (player_position % 2)
),
scored AS (
  SELECT game_result_id, round_number, team,
    CASE WHEN tricks >= reg_bid THEN reg_bid*10 + (tricks - reg_bid)
         ELSE -reg_bid*10 END + nil_bonus AS rpts,
    CASE WHEN tricks >= reg_bid THEN tricks - reg_bid ELSE 0 END AS rbags
  FROM tr
),
running AS (
  SELECT game_result_id, round_number, team,
    SUM(rpts)  OVER w - FLOOR(SUM(rbags) OVER w / 10.0) * 100 AS score   -- FLOOR: see type gotcha
  FROM scored
  WINDOW w AS (PARTITION BY game_result_id, team ORDER BY round_number)
),
wide AS (
  SELECT a.game_result_id AS gid, a.round_number AS rd,
         a.score AS t1, b.score AS t2, a.score - b.score AS diff
  FROM running a
  JOIN running b USING (game_result_id, round_number)
  WHERE a.team = 0 AND b.team = 1
)
SELECT g.room_id,
  (ARRAY_AGG(w.t1 ORDER BY w.rd DESC))[1] AS final_t1, g.team1_score AS stored_t1,
  (ARRAY_AGG(w.t2 ORDER BY w.rd DESC))[1] AS final_t2, g.team2_score AS stored_t2,
  CASE WHEN (ARRAY_AGG(w.t1 ORDER BY w.rd DESC))[1] = g.team1_score
        AND (ARRAY_AGG(w.t2 ORDER BY w.rd DESC))[1] = g.team2_score
       THEN 'OK' ELSE 'MISMATCH' END AS valid
FROM wide w
JOIN game_results g ON g.id = w.gid
GROUP BY g.id, g.room_id, g.team1_score, g.team2_score, g.completed_at
ORDER BY g.completed_at;
```

### 7. Per-game drama metrics (margin, lead changes, comeback index)

Builds on the `wide` CTE from query 6. `comeback_from` = the largest deficit the
eventual winner climbed out of; `lead_chg` = number of times the lead flipped.

```sql
-- (prepend the tr / scored / running / wide CTEs from query 6, then:)
, finals AS (
  SELECT gid, MAX(rd) AS rounds,
    (ARRAY_AGG(t1   ORDER BY rd DESC))[1] AS ft1,
    (ARRAY_AGG(t2   ORDER BY rd DESC))[1] AS ft2,
    (ARRAY_AGG(diff ORDER BY rd DESC))[1] AS fdiff
  FROM wide GROUP BY gid
),
comeback AS (
  SELECT w.gid,
    MAX(GREATEST(0, CASE WHEN f.fdiff > 0 THEN -w.diff ELSE w.diff END)) AS max_deficit
  FROM wide w JOIN finals f ON f.gid = w.gid GROUP BY w.gid
),
lead AS (
  SELECT gid, COUNT(*) AS lead_changes FROM (
    SELECT gid, SIGN(diff) s,
           LAG(SIGN(diff)) OVER (PARTITION BY gid ORDER BY rd) prev
    FROM wide WHERE diff <> 0
  ) x WHERE prev IS NOT NULL AND s <> prev GROUP BY gid
)
SELECT g.room_id, f.rounds, f.ft1 AS final_t1, f.ft2 AS final_t2,
  CASE WHEN f.fdiff > 0 THEN 'T1' ELSE 'T2' END AS winner,
  ABS(f.fdiff) AS margin,
  COALESCE(l.lead_changes, 0) AS lead_chg,
  c.max_deficit AS comeback_from
FROM finals f
JOIN game_results g ON g.id = f.gid
JOIN comeback c ON c.gid = f.gid
LEFT JOIN lead l ON l.gid = f.gid
ORDER BY c.max_deficit DESC, ABS(f.fdiff) ASC;
```

### 8. Round-by-round trace for a single game

Swap the `room_id` literal. Useful for telling the story of a specific game.

```sql
WITH tr AS (
  SELECT round_number, (player_position % 2) AS team,
    SUM(bid) AS reg_bid, SUM(tricks_won) AS tricks,
    SUM(CASE WHEN (is_nil OR is_blind_nil)
             THEN (CASE WHEN tricks_won = 0 THEN 1 ELSE -1 END)
                  * (CASE WHEN is_blind_nil THEN 200 ELSE 100 END)
             ELSE 0 END) AS nil_bonus
  FROM round_bids
  WHERE game_result_id = (SELECT id FROM game_results WHERE room_id = 'EZ57XL')
  GROUP BY round_number, (player_position % 2)
),
scored AS (
  SELECT round_number, team,
    CASE WHEN tricks >= reg_bid THEN reg_bid*10 + (tricks - reg_bid)
         ELSE -reg_bid*10 END + nil_bonus AS rpts,
    CASE WHEN tricks >= reg_bid THEN tricks - reg_bid ELSE 0 END AS rbags
  FROM tr
),
running AS (
  SELECT round_number, team, rpts,
    SUM(rpts) OVER w - FLOOR(SUM(rbags) OVER w / 10.0) * 100 AS score
  FROM scored WINDOW w AS (PARTITION BY team ORDER BY round_number)
)
SELECT a.round_number AS rd,
  a.rpts AS t1_round, a.score AS t1_total,
  b.rpts AS t2_round, b.score AS t2_total,
  a.score - b.score AS t1_lead
FROM running a JOIN running b USING (round_number)
WHERE a.team = 0 AND b.team = 1
ORDER BY a.round_number;
```

---

## Rejected metrics (and why)

Kept here so we don't reinvent them:

- **Individual bid accuracy** (`tricks_won` vs `bid`, exact-hit %, mean absolute
  error, over/under index) — uninterpretable; see Philosophy §2.
- **Cover rate / partner-rescue rate** — same flaw: "you covered a short
  partner" and "your partner ducked for you" are indistinguishable from the
  data. Rejected even though it was an appealing reframing.
