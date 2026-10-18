// Turns a transcribed paper scoresheet (JSON) into a one-off SQL script that
// records an in-person game in game_results/round_bids. Run against prod with
// psql; see .claude/skills/import-irl-game/SKILL.md for the full workflow.
//
//   pnpm --filter @spades/server irl-game-sql <game.json> [--allow-paper-mismatch]
//
// The SQL goes to stdout and a round-by-round score table to stderr. Scoring is
// replayed with the shared game logic, so a transcription that doesn't
// reproduce the paper's running totals is caught here, before anything runs.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  calculateRoundScore,
  updateTeamScore,
  DEFAULT_GAME_CONFIG,
} from '@spades/shared';
import type { PlayerBid, TeamScore } from '@spades/shared';

type BidSpec = number | 'nil' | 'blind';

interface IrlRound {
  // initial -> [bid, tricks taken]
  play: Record<string, [BidSpec, number]>;
  // Running totals written on the sheet after this round, [team1, team2].
  // Optional; null for an unreadable cell.
  paper?: [number | null, number | null];
}

export interface IrlGame {
  roomId: string;
  playedAt: string;
  // Seat order: team1[0] -> 0, team2[0] -> 1, team1[1] -> 2, team2[1] -> 3.
  team1: [string, string];
  team2: [string, string];
  // initial -> users.email
  players: Record<string, string>;
  rounds: IrlRound[];
}

interface ScoredRound {
  points: [number, number];
  totals: [number, number];
}

function fail(message: string): never {
  throw new Error(message);
}

function isBidSpec(value: unknown): value is BidSpec {
  return (
    value === 'nil' ||
    value === 'blind' ||
    (Number.isInteger(value) &&
      (value as number) >= 1 &&
      (value as number) <= 13)
  );
}

export function parseGame(raw: unknown): IrlGame {
  const game = raw as IrlGame;
  if (typeof game !== 'object' || game === null) fail('game must be an object');
  if (
    typeof game.roomId !== 'string' ||
    !/^IRL-[A-Za-z0-9-]+$/.test(game.roomId)
  )
    fail('roomId must look like IRL-YYYYMMDD');
  if (
    typeof game.playedAt !== 'string' ||
    Number.isNaN(Date.parse(game.playedAt))
  )
    fail('playedAt must be an ISO timestamp with a UTC offset');

  const initials = [game.team1, game.team2].flatMap((team, i) => {
    if (!Array.isArray(team) || team.length !== 2)
      fail(`team${i + 1} must list two player initials`);
    return team;
  });
  if (new Set(initials).size !== 4)
    fail('the four player initials must be distinct');
  for (const initial of initials) {
    const email = game.players?.[initial];
    if (typeof email !== 'string' || !/^[^\s@']+@[^\s@']+$/.test(email))
      fail(`players.${initial} must be the user's email`);
  }

  if (!Array.isArray(game.rounds) || game.rounds.length === 0)
    fail('rounds must be a non-empty array');
  game.rounds.forEach((round, i) => {
    const label = `round ${i + 1}`;
    const keys = Object.keys(round?.play ?? {});
    if (keys.length !== 4 || !initials.every((p) => keys.includes(p)))
      fail(`${label}: play must have exactly ${initials.join(', ')}`);
    let tricks = 0;
    for (const p of initials) {
      const entry = round.play[p];
      if (!Array.isArray(entry) || entry.length !== 2 || !isBidSpec(entry[0]))
        fail(`${label}: ${p} must be [bid (1-13, "nil" or "blind"), tricks]`);
      if (!Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] > 13)
        fail(`${label}: ${p} tricks must be 0-13`);
      tricks += entry[1];
    }
    if (tricks !== 13) fail(`${label}: tricks total ${tricks}, not 13`);
  });
  return game;
}

// Replays the game through the same scoring functions the server uses.
export function scoreGame(game: IrlGame): ScoredRound[] {
  const scores: [TeamScore, TeamScore] = [
    { teamId: 'team1', score: 0, bags: 0, roundBid: 0, roundTricks: 0 },
    { teamId: 'team2', score: 0, bags: 0, roundBid: 0, roundTricks: 0 },
  ];
  return game.rounds.map((round) => {
    const points = [game.team1, game.team2].map((team, t) => {
      const nilBids: PlayerBid[] = [];
      let bid = 0;
      let tricks = 0;
      const playerTricks: Record<string, number> = {};
      for (const p of team) {
        const [spec, taken] = round.play[p];
        playerTricks[p] = taken;
        tricks += taken;
        if (typeof spec === 'number') bid += spec;
        else
          nilBids.push({
            playerId: p,
            bid: 0,
            isNil: spec === 'nil',
            isBlindNil: spec === 'blind',
          });
      }
      const calc = calculateRoundScore(bid, tricks, nilBids, playerTricks);
      scores[t] = updateTeamScore(scores[t], calc, DEFAULT_GAME_CONFIG);
      return calc.totalScore;
    });
    return {
      points: [points[0], points[1]],
      totals: [scores[0].score, scores[1].score],
    };
  });
}

export function paperMismatches(
  game: IrlGame,
  scored: ScoredRound[]
): string[] {
  const problems: string[] = [];
  game.rounds.forEach((round, i) => {
    round.paper?.forEach((written, t) => {
      if (written !== null && written !== scored[i].totals[t])
        problems.push(
          `round ${i + 1} team${t + 1}: paper ${written}, replayed ${scored[i].totals[t]}`
        );
    });
  });
  return problems;
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

export function buildSql(game: IrlGame, scored: ScoredRound[]): string {
  const [t1, t2] = scored[scored.length - 1].totals;
  const seats = [game.team1[0], game.team2[0], game.team1[1], game.team2[1]];
  const emails = seats.map((p) => game.players[p]);
  const playedAt = `TIMESTAMPTZ ${q(game.playedAt)}`;
  const roundRows = game.rounds
    .flatMap((round, i) =>
      seats.map((p) => {
        const [spec, taken] = round.play[p];
        const bid = typeof spec === 'number' ? spec : 0;
        return `  (${i + 1}, ${q(p)}, ${bid}, ${spec === 'nil'}, ${spec === 'blind'}, ${taken})`;
      })
    )
    .join(',\n');

  return `-- Generated by apps/server/src/scripts/irl-game-sql.ts. Records in-person game
-- ${game.roomId}: ${game.team1.join('+')} ${t1} vs ${game.team2.join('+')} ${t2}, ${game.rounds.length} rounds.
--
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>

-- Preview: must show exactly one row per player.
SELECT id, display_name, email FROM users
WHERE email IN (${emails.map(q).join(', ')})
ORDER BY display_name;

BEGIN;

CREATE TEMP TABLE irl_players (initial TEXT PRIMARY KEY, email TEXT, pos SMALLINT) ON COMMIT DROP;
INSERT INTO irl_players VALUES
${seats.map((p, pos) => `  (${q(p)}, ${q(game.players[p])}, ${pos})`).join(',\n')};

-- Fail loudly unless each email matches exactly one user.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.initial, COUNT(u.id) AS n
    FROM irl_players p LEFT JOIN users u ON u.email = p.email
    GROUP BY p.initial
  LOOP
    IF r.n <> 1 THEN
      RAISE EXCEPTION 'player % matched % users (expected 1)', r.initial, r.n;
    END IF;
  END LOOP;
END $$;

-- Guard against running twice.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM game_results WHERE room_id = ${q(game.roomId)}) THEN
    RAISE EXCEPTION 'game % already recorded', ${q(game.roomId)};
  END IF;
END $$;

CREATE TEMP TABLE irl_ids ON COMMIT DROP AS
SELECT p.initial, p.pos, u.id AS user_id
FROM irl_players p JOIN users u ON u.email = p.email;

CREATE TEMP TABLE irl_game ON COMMIT DROP AS SELECT gen_random_uuid() AS id;

INSERT INTO game_results
  (id, room_id, team1_score, team2_score, rounds_played,
   team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
   completed_at)
VALUES (
  (SELECT id FROM irl_game), ${q(game.roomId)}, ${t1}, ${t2}, ${game.rounds.length},
  (SELECT user_id FROM irl_ids WHERE pos = 0),
  (SELECT user_id FROM irl_ids WHERE pos = 2),
  (SELECT user_id FROM irl_ids WHERE pos = 1),
  (SELECT user_id FROM irl_ids WHERE pos = 3),
  ${playedAt}
);

INSERT INTO round_bids
  (game_result_id, round_number, player_id, player_position,
   bid, is_nil, is_blind_nil, tricks_won, created_at)
SELECT g.id, v.round_number, i.user_id, i.pos,
       v.bid, v.is_nil, v.is_blind_nil, v.tricks_won, ${playedAt}
FROM irl_game g
CROSS JOIN (VALUES
${roundRows}
) AS v(round_number, initial, bid, is_nil, is_blind_nil, tricks_won)
JOIN irl_ids i ON i.initial = v.initial;

-- Self-check: replay scoring over the inserted rows in SQL (independently of
-- the TypeScript replay that produced the finals) and abort on any mismatch.
DO $$
DECLARE
  bad_rounds INT;
  t1 INT;
  t2 INT;
BEGIN
  SELECT COUNT(*) INTO bad_rounds FROM (
    SELECT round_number FROM round_bids
    WHERE game_result_id = (SELECT id FROM irl_game)
    GROUP BY round_number HAVING SUM(tricks_won) <> 13
  ) x;
  IF bad_rounds > 0 THEN
    RAISE EXCEPTION '% round(s) do not total 13 tricks', bad_rounds;
  END IF;

  WITH team_round AS (
    SELECT player_position % 2 AS team, round_number,
           SUM(bid) AS reg_bid,
           SUM(tricks_won) AS tricks,
           SUM(CASE WHEN is_nil OR is_blind_nil THEN
                 (CASE WHEN is_blind_nil THEN 200 ELSE 100 END)
                 * (CASE WHEN tricks_won = 0 THEN 1 ELSE -1 END)
               ELSE 0 END) AS nil_bonus
    FROM round_bids
    WHERE game_result_id = (SELECT id FROM irl_game)
    GROUP BY 1, 2
  ), scored AS (
    SELECT team,
           CASE WHEN tricks >= reg_bid THEN reg_bid * 10 + (tricks - reg_bid)
                ELSE -reg_bid * 10 END + nil_bonus AS pts,
           CASE WHEN tricks >= reg_bid THEN tricks - reg_bid ELSE 0 END AS bags
    FROM team_round
  )
  SELECT
    MAX(CASE WHEN team = 0 THEN total END),
    MAX(CASE WHEN team = 1 THEN total END)
  INTO t1, t2
  FROM (
    SELECT team, (SUM(pts) - FLOOR(SUM(bags) / 10.0) * 100)::INT AS total
    FROM scored GROUP BY team
  ) f;

  IF t1 <> ${t1} OR t2 <> ${t2} THEN
    RAISE EXCEPTION 'replayed finals % / % do not match ${t1} / ${t2}', t1, t2;
  END IF;
  RAISE NOTICE 'OK: replayed finals % / %', t1, t2;
END $$;

COMMIT;
`;
}

function main(): void {
  const args = process.argv.slice(2);
  const allowMismatch = args.includes('--allow-paper-mismatch');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: irl-game-sql <game.json> [--allow-paper-mismatch]');
    process.exit(2);
  }

  const game = parseGame(JSON.parse(readFileSync(file, 'utf8')));
  const scored = scoreGame(game);
  const names = [game.team1.join('+'), game.team2.join('+')];
  console.error(`round  ${names[0].padStart(13)}  ${names[1].padStart(13)}`);
  let penalized = false;
  scored.forEach((r, i) => {
    const cell = (t: number) => {
      const pts = r.points[t];
      // Points are pre-penalty, like the paper; flag rounds where the total
      // moved by something else.
      const prev = i === 0 ? 0 : scored[i - 1].totals[t];
      const flag = r.totals[t] - prev !== pts ? '*' : ' ';
      penalized ||= flag === '*';
      return `${pts >= 0 ? '+' : ''}${pts} = ${r.totals[t]}${flag}`.padStart(
        13
      );
    };
    console.error(`${String(i + 1).padStart(5)}  ${cell(0)}  ${cell(1)}`);
  });
  if (penalized) console.error('* total includes a bag penalty');

  const problems = paperMismatches(game, scored);
  if (problems.length > 0) {
    console.error(`\nDoes not match the paper:\n  ${problems.join('\n  ')}`);
    if (!allowMismatch) {
      console.error('Fix the transcription, or pass --allow-paper-mismatch.');
      process.exit(1);
    }
  }
  process.stdout.write(buildSql(game, scored));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
