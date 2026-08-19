// Integration coverage for the db/ layer against a real Postgres.
//
// game-results.test.ts (the sibling spec) mocks `../client.js` wholesale, so it
// verifies the JS around the SQL — column order, aggregation math, rollback
// bookkeeping — while proving nothing about the SQL itself. Everything below is
// what a mocked pool structurally cannot catch: whether the DDL runs, whether
// the queries parse, whether schema constraints fire, and whether Postgres
// returns the types the parsing code assumes.
//
// Nothing here mocks `../client.js` — the real pool is the point.
//
// Self-skips without DATABASE_URL so `pnpm test` is unchanged locally. CI sets
// it from the postgres service container (see .github/workflows/ci.yml). To run
// these locally:
//   docker run --rm -e POSTGRES_USER=spades -e POSTGRES_PASSWORD=spades \
//     -e POSTGRES_DB=spades_test -p 5432:5432 postgres:17
//   DATABASE_URL=postgres://spades:spades@localhost:5432/spades_test \
//     pnpm --filter @spades/server test
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pool } from '../client.js';
import {
  insertGameResult,
  getPlayerStats,
  getNilStats,
  getBidStats,
} from '../game-results.js';
import type { GameResultData } from '../game-results.js';
import { createTables } from '../schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

async function seedUser(name: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (google_id, email, display_name)
     VALUES ($1, $2, $3) RETURNING id`,
    [`google-${name}`, `${name}@example.com`, name]
  );
  return result.rows[0].id;
}

/** A round where each seat bid `bids[i]` and took `tricks[i]`. */
function roundBids(
  roundNumber: number,
  seats: [string, string, string, string],
  bids: [number, number, number, number],
  tricks: [number, number, number, number]
): GameResultData['roundBids'] {
  return seats.map((playerId, position) => ({
    roundNumber,
    playerId,
    playerPosition: position,
    bid: bids[position],
    isNil: bids[position] === 0,
    isBlindNil: false,
    tricksWon: tricks[position],
  }));
}

describe.skipIf(!DATABASE_URL)('db integration (real Postgres)', () => {
  let alice: string;
  let bob: string;
  let charlie: string;
  let diana: string;

  beforeAll(async () => {
    // createTables() is idempotent by design and runs on every prod boot, but
    // nothing exercised it before this — a syntax error in the DDL would have
    // shipped.
    await createTables();
  });

  beforeEach(async () => {
    // round_bids/user_preferences cascade from their parents.
    await pool.query('TRUNCATE game_results, users CASCADE');
    alice = await seedUser('alice');
    bob = await seedUser('bob');
    charlie = await seedUser('charlie');
    diana = await seedUser('diana');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('schema', () => {
    it('is idempotent — a second createTables() is a no-op', async () => {
      await expect(createTables()).resolves.toBeUndefined();
    });

    it('enforces the bid/nil CHECK constraint', async () => {
      const game = await pool.query<{ id: string }>(
        `INSERT INTO game_results
           (room_id, team1_score, team2_score, rounds_played)
         VALUES ('ROOM01', 500, 300, 5) RETURNING id`
      );
      // (bid = 0) = (is_nil OR is_blind_nil): a 0 bid that isn't flagged nil is
      // exactly the corruption that would silently skew every bid average.
      await expect(
        pool.query(
          `INSERT INTO round_bids
             (game_result_id, round_number, player_id, player_position,
              bid, is_nil, is_blind_nil, tricks_won)
           VALUES ($1, 1, $2, 0, 0, false, false, 2)`,
          [game.rows[0].id, alice]
        )
      ).rejects.toThrow();
    });

    it('nulls a deleted user out of game_results rather than dropping the game', async () => {
      await insertGameResult({
        roomId: 'ROOM01',
        team1Score: 500,
        team2Score: 300,
        roundsPlayed: 5,
        team1Player1Id: alice,
        team1Player2Id: charlie,
        team2Player1Id: bob,
        team2Player2Id: diana,
        roundBids: [],
      });

      await pool.query('DELETE FROM users WHERE id = $1', [alice]);

      // ON DELETE SET NULL — the row survives with a null seat.
      const rows = await pool.query<{ team1_player1_id: string | null }>(
        'SELECT team1_player1_id FROM game_results'
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].team1_player1_id).toBeNull();
    });
  });

  describe('insertGameResult', () => {
    it('commits the game and its round bids in one transaction', async () => {
      await insertGameResult({
        roomId: 'ROOM01',
        team1Score: 512,
        team2Score: 340,
        roundsPlayed: 2,
        team1Player1Id: alice,
        team1Player2Id: charlie,
        team2Player1Id: bob,
        team2Player2Id: diana,
        roundBids: [
          ...roundBids(
            1,
            [alice, bob, charlie, diana],
            [3, 2, 4, 4],
            [4, 2, 4, 3]
          ),
          ...roundBids(
            2,
            [alice, bob, charlie, diana],
            [5, 3, 2, 3],
            [5, 3, 2, 3]
          ),
        ],
      });

      const games = await pool.query('SELECT * FROM game_results');
      expect(games.rowCount).toBe(1);

      const bids = await pool.query('SELECT * FROM round_bids');
      expect(bids.rowCount).toBe(8);
    });

    it('rolls back the game row when a round bid violates a constraint', async () => {
      await expect(
        insertGameResult({
          roomId: 'ROOM02',
          team1Score: 500,
          team2Score: 300,
          roundsPlayed: 1,
          team1Player1Id: alice,
          team1Player2Id: charlie,
          team2Player1Id: bob,
          team2Player2Id: diana,
          roundBids: [
            {
              roundNumber: 1,
              playerId: alice,
              playerPosition: 0,
              bid: 0,
              isNil: false, // violates the CHECK
              isBlindNil: false,
              tricksWon: 1,
            },
          ],
        })
      ).rejects.toThrow();

      // The mocked spec asserts ROLLBACK was *called*; this asserts it worked.
      const games = await pool.query('SELECT * FROM game_results');
      expect(games.rowCount).toBe(0);
    });
  });

  describe('getPlayerStats', () => {
    beforeEach(async () => {
      // Alice+Charlie win one, lose one. Alice+Bob win one.
      await insertGameResult({
        roomId: 'ROOM01',
        team1Score: 500,
        team2Score: 300,
        roundsPlayed: 5,
        team1Player1Id: alice,
        team1Player2Id: charlie,
        team2Player1Id: bob,
        team2Player2Id: diana,
        roundBids: [],
      });
      await insertGameResult({
        roomId: 'ROOM02',
        team1Score: 200,
        team2Score: 500,
        roundsPlayed: 7,
        team1Player1Id: alice,
        team1Player2Id: charlie,
        team2Player1Id: bob,
        team2Player2Id: diana,
        roundBids: [],
      });
      await insertGameResult({
        roomId: 'ROOM03',
        team1Score: 520,
        team2Score: 410,
        roundsPlayed: 6,
        team1Player1Id: alice,
        team1Player2Id: bob,
        team2Player1Id: charlie,
        team2Player2Id: diana,
        roundBids: [],
      });

      // completed_at defaults to NOW(), which is transaction-start time — three
      // back-to-back inserts can land close enough together that ORDER BY
      // completed_at DESC has no stable tiebreak. Pin them so the recent-games
      // ordering assertion below is deterministic rather than usually-right.
      await pool.query(
        `UPDATE game_results SET completed_at = NOW() - (
           CASE room_id WHEN 'ROOM01' THEN INTERVAL '3 hours'
                        WHEN 'ROOM02' THEN INTERVAL '2 hours'
                        ELSE INTERVAL '1 hour' END)`
      );
    });

    it('computes win/loss from whichever seat the player held', async () => {
      const stats = await getPlayerStats(alice);
      expect(stats.totalGames).toBe(3);
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.winRate).toBe(67);
    });

    it('scores the same games from the losing seat', async () => {
      const stats = await getPlayerStats(diana);
      expect(stats.totalGames).toBe(3);
      expect(stats.wins).toBe(1); // ROOM02
      expect(stats.losses).toBe(2);
    });

    it('resolves partner display names and per-partner records', async () => {
      const stats = await getPlayerStats(alice);
      const byName = Object.fromEntries(
        stats.partners.map((p) => [p.displayName, p])
      );
      expect(byName.charlie).toMatchObject({
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
      });
      expect(byName.bob).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0 });
    });

    it('returns recent games newest-first with resolved opponents', async () => {
      const stats = await getPlayerStats(alice);
      expect(stats.recentGames).toHaveLength(3);
      const [newest] = stats.recentGames;
      expect(newest.partner).toBe('bob'); // ROOM03, inserted last
      expect(newest.myScore).toBe(520);
      expect(newest.opponentScore).toBe(410);
      expect(newest.won).toBe(true);
      expect(newest.opponents.sort()).toEqual(['charlie', 'diana']);
    });

    it('returns empty stats for a user with no games', async () => {
      const stats = await getPlayerStats(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(stats.totalGames).toBe(0);
      expect(stats.recentGames).toEqual([]);
      expect(stats.partners).toEqual([]);
    });
  });

  describe('getBidStats', () => {
    beforeEach(async () => {
      // Round 1 — Alice(0)+Charlie(2) bid 3+4=7, took 4+4=8 → 1 bag.
      //           Bob(1)+Diana(3)   bid 2+4=6, took 2+3=5 → set.
      // Round 2 — Alice+Charlie bid 5+2=7, took 5+2=7 → exact, 0 bags.
      //           Bob+Diana     bid 3+3=6, took 3+3=6 → exact.
      await insertGameResult({
        roomId: 'ROOM01',
        team1Score: 512,
        team2Score: 340,
        roundsPlayed: 2,
        team1Player1Id: alice,
        team1Player2Id: charlie,
        team2Player1Id: bob,
        team2Player2Id: diana,
        roundBids: [
          ...roundBids(
            1,
            [alice, bob, charlie, diana],
            [3, 2, 4, 4],
            [4, 2, 4, 3]
          ),
          ...roundBids(
            2,
            [alice, bob, charlie, diana],
            [5, 3, 2, 3],
            [5, 3, 2, 3]
          ),
        ],
      });
    });

    it('joins each seat to its partner across (position + 2) % 4', async () => {
      const stats = await getBidStats(alice);
      expect(stats.totalRounds).toBe(2);
      // Alice bid 3 then 5; her team bid 7 then 7.
      expect(stats.individualAvgBid).toBe(4);
      expect(stats.teamAvgBid).toBe(7);
      expect(stats.individualAvgTricks).toBe(4.5);
      expect(stats.teamAvgTricks).toBe(7.5);
    });

    it('averages team bags and computes the set rate as real numbers', async () => {
      const stats = await getBidStats(alice);
      // 1 bag in round 1, 0 in round 2.
      expect(stats.avgBags).toBe(0.5);
      expect(stats.setBidRate).toBe(0);
      // Every numeric field must survive Postgres' numeric->text->parseFloat
      // round trip as a finite number, not a string or NaN.
      for (const v of [
        stats.individualAvgBid,
        stats.teamAvgBid,
        stats.individualAvgTricks,
        stats.teamAvgTricks,
        stats.avgBags,
        stats.setBidRate,
      ]) {
        expect(typeof v).toBe('number');
        expect(Number.isFinite(v)).toBe(true);
      }
    });

    it('counts a set team round from the seat that was set', async () => {
      const stats = await getBidStats(bob);
      expect(stats.totalRounds).toBe(2);
      expect(stats.setBidRate).toBe(50); // round 1 set, round 2 made
    });

    it('excludes the player from their own comparison baseline', async () => {
      const stats = await getBidStats(alice);
      expect(stats.others).not.toBeNull();
      // Baseline is Bob/Diana's team rounds only — bid 6 both rounds.
      expect(stats.others?.teamAvgBid).toBe(6);
      expect(stats.others?.setBidRate).toBe(50);
    });

    it('returns zeroed stats for a player with no rounds', async () => {
      const stats = await getBidStats('00000000-0000-0000-0000-000000000000');
      expect(stats.totalRounds).toBe(0);
    });
  });

  describe('getNilStats', () => {
    beforeEach(async () => {
      await insertGameResult({
        roomId: 'ROOM01',
        team1Score: 400,
        team2Score: 300,
        roundsPlayed: 3,
        team1Player1Id: alice,
        team1Player2Id: charlie,
        team2Player1Id: bob,
        team2Player2Id: diana,
        roundBids: [
          // R1: Alice nil, made (0 tricks). Charlie (partner) bid 5.
          ...roundBids(
            1,
            [alice, bob, charlie, diana],
            [0, 4, 5, 4],
            [0, 4, 6, 3]
          ),
          // R2: Alice nil, failed (2 tricks).
          ...roundBids(
            2,
            [alice, bob, charlie, diana],
            [0, 3, 6, 4],
            [2, 3, 5, 3]
          ),
          // R3: Charlie nil, made — exercises the partner-side query for Alice.
          ...roundBids(
            3,
            [alice, bob, charlie, diana],
            [4, 3, 0, 3],
            [5, 3, 0, 5]
          ),
        ],
      });
    });

    it('counts made and failed nils from real rows', async () => {
      const stats = await getNilStats(alice);
      expect(stats.totalAttempts).toBe(2);
      expect(stats.succeeded).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe(50);
    });

    it("counts the partner's nils separately via the partner join", async () => {
      const stats = await getNilStats(alice);
      expect(stats.asPartner.totalAttempts).toBe(1); // Charlie's R3 nil
      expect(stats.asPartner.succeeded).toBe(1);
    });

    it('separates blind nils from plain nils', async () => {
      // A blind nil is bid 0 with is_blind_nil — the CHECK forbids setting both
      // flags, so this row can only be written directly.
      const game = await pool.query<{ id: string }>(
        `INSERT INTO game_results
           (room_id, team1_score, team2_score, rounds_played, team1_player1_id)
         VALUES ('ROOM02', 300, 200, 1, $1) RETURNING id`,
        [alice]
      );
      await pool.query(
        `INSERT INTO round_bids
           (game_result_id, round_number, player_id, player_position,
            bid, is_nil, is_blind_nil, tricks_won)
         VALUES ($1, 1, $2, 0, 0, false, true, 0)`,
        [game.rows[0].id, alice]
      );

      const stats = await getNilStats(alice);
      expect(stats.blindNilAttempts).toBe(1);
      expect(stats.blindNilSucceeded).toBe(1);
      expect(stats.blindNilSuccessRate).toBe(100);
      // Blind nils also roll up into the overall attempt count.
      expect(stats.totalAttempts).toBe(3);
    });

    it('returns zeroed stats for a player who never bid nil', async () => {
      const stats = await getNilStats('00000000-0000-0000-0000-000000000000');
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });
});
