import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock factory is hoisted — it cannot reference outer variables.
// Use vi.hoisted() to declare the mocks so they're available inside the factory.
const { mockQuery, mockRelease, mockConnect } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockConnect = vi.fn(() =>
    Promise.resolve({ query: mockQuery, release: mockRelease })
  );
  return { mockQuery, mockRelease, mockConnect };
});

vi.mock('../client.js', () => ({
  pool: {
    connect: mockConnect,
    query: mockQuery,
  },
}));

import {
  insertGameResult,
  getPlayerStats,
  getNilStats,
  getBidStats,
} from '../game-results.js';
import type { GameResultData } from '../game-results.js';

function makeGameResultData(
  overrides?: Partial<GameResultData>
): GameResultData {
  return {
    roomId: 'ROOM01',
    team1Score: 510,
    team2Score: 340,
    roundsPlayed: 5,
    team1Player1Id: 'user-a',
    team1Player2Id: 'user-c',
    team2Player1Id: 'user-b',
    team2Player2Id: 'user-d',
    roundBids: [],
    ...overrides,
  };
}

describe('game-results', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost/test');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('insertGameResult', () => {
    it('should insert game result with correct column order', async () => {
      mockQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'game-123' }] }) // INSERT game_results
        .mockResolvedValueOnce(undefined); // COMMIT

      await insertGameResult(makeGameResultData());

      // Verify BEGIN/COMMIT transaction
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');

      // Verify INSERT params: position→column mapping is the critical check.
      // pos 0 → team1_player1, pos 2 → team1_player2,
      // pos 1 → team2_player1, pos 3 → team2_player2
      const insertCall = mockQuery.mock.calls[1];
      const params = insertCall[1];
      expect(params).toEqual([
        'ROOM01', // room_id
        510, // team1_score
        340, // team2_score
        5, // rounds_played
        'user-a', // team1_player1_id
        'user-c', // team1_player2_id
        'user-b', // team2_player1_id
        'user-d', // team2_player2_id
      ]);
    });

    it('should insert round bids after the game result', async () => {
      mockQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'game-456' }] }) // INSERT game_results
        .mockResolvedValueOnce(undefined) // INSERT round_bids #1
        .mockResolvedValueOnce(undefined) // INSERT round_bids #2
        .mockResolvedValueOnce(undefined); // COMMIT

      await insertGameResult(
        makeGameResultData({
          roundBids: [
            {
              roundNumber: 1,
              playerId: 'user-a',
              playerPosition: 0,
              bid: 4,
              isNil: false,
              isBlindNil: false,
              tricksWon: 5,
            },
            {
              roundNumber: 1,
              playerId: 'user-b',
              playerPosition: 1,
              bid: 3,
              isNil: false,
              isBlindNil: false,
              tricksWon: 2,
            },
          ],
        })
      );

      // 5 calls: BEGIN, INSERT game, INSERT bid 1, INSERT bid 2, COMMIT
      expect(mockQuery).toHaveBeenCalledTimes(5);

      // Verify first round bid insert
      const bidCall1 = mockQuery.mock.calls[2];
      expect(bidCall1[1]).toEqual([
        'game-456', // game_result_id
        1, // round_number
        'user-a', // player_id
        0, // player_position
        4, // bid
        false, // is_nil
        false, // is_blind_nil
        5, // tricks_won
      ]);
    });

    it('should handle null player IDs', async () => {
      mockQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: 'game-789' }] })
        .mockResolvedValueOnce(undefined);

      await insertGameResult(
        makeGameResultData({
          team1Player1Id: null,
          team2Player2Id: null,
        })
      );

      const params = mockQuery.mock.calls[1][1];
      expect(params[3 + 1]).toBeNull(); // team1_player1_id (index 4)
      expect(params[3 + 4]).toBeNull(); // team2_player2_id (index 7)
    });

    it('should rollback on error', async () => {
      mockQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')) // INSERT fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(insertGameResult(makeGameResultData())).rejects.toThrow(
        'DB error'
      );
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should release client even on error', async () => {
      mockQuery
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined);

      await expect(insertGameResult(makeGameResultData())).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it('should no-op when DATABASE_URL is not set', async () => {
      vi.stubEnv('DATABASE_URL', '');
      await insertGameResult(makeGameResultData());
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('getPlayerStats', () => {
    it('should return empty stats when no games found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const stats = await getPlayerStats('user-a');
      expect(stats.totalGames).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.recentGames).toEqual([]);
      expect(stats.partners).toEqual([]);
    });

    it('should compute win/loss stats from query rows', async () => {
      mockQuery
        // Main games query
        .mockResolvedValueOnce({
          rows: [
            {
              completed_at: '2026-03-15T00:00:00Z',
              won: true,
              my_score: 510,
              opponent_score: 340,
              partner_id: 'user-c',
              opponent1_id: 'user-b',
              opponent2_id: 'user-d',
            },
            {
              completed_at: '2026-03-14T00:00:00Z',
              won: false,
              my_score: 420,
              opponent_score: 505,
              partner_id: 'user-c',
              opponent1_id: 'user-b',
              opponent2_id: 'user-d',
            },
            {
              completed_at: '2026-03-13T00:00:00Z',
              won: true,
              my_score: 530,
              opponent_score: 285,
              partner_id: 'user-b',
              opponent1_id: 'user-c',
              opponent2_id: 'user-d',
            },
          ],
        })
        // Name resolution query
        .mockResolvedValueOnce({
          rows: [
            { id: 'user-b', display_name: 'Bob' },
            { id: 'user-c', display_name: 'Charlie' },
            { id: 'user-d', display_name: 'Diana' },
          ],
        });

      const stats = await getPlayerStats('user-a');
      expect(stats.totalGames).toBe(3);
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.winRate).toBe(67);
    });

    it('should aggregate partner stats correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              completed_at: '2026-03-15',
              won: true,
              my_score: 510,
              opponent_score: 340,
              partner_id: 'user-c',
              opponent1_id: 'user-b',
              opponent2_id: 'user-d',
            },
            {
              completed_at: '2026-03-14',
              won: false,
              my_score: 420,
              opponent_score: 505,
              partner_id: 'user-c',
              opponent1_id: 'user-b',
              opponent2_id: 'user-d',
            },
            {
              completed_at: '2026-03-13',
              won: true,
              my_score: 530,
              opponent_score: 285,
              partner_id: 'user-b',
              opponent1_id: 'user-c',
              opponent2_id: 'user-d',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 'user-b', display_name: 'Bob' },
            { id: 'user-c', display_name: 'Charlie' },
            { id: 'user-d', display_name: 'Diana' },
          ],
        });

      const stats = await getPlayerStats('user-a');

      // Charlie was partner 2 times (1 win, 1 loss) — most games, listed first
      expect(stats.partners[0]).toEqual({
        displayName: 'Charlie',
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
      });
      // Bob was partner 1 time (1 win)
      expect(stats.partners[1]).toEqual({
        displayName: 'Bob',
        gamesPlayed: 1,
        wins: 1,
        losses: 0,
      });
    });

    it('should limit recent games to 5', async () => {
      const rows = Array.from({ length: 8 }, (_, i) => ({
        completed_at: `2026-03-${15 - i}`,
        won: i % 2 === 0,
        my_score: 500,
        opponent_score: 400,
        partner_id: 'user-c',
        opponent1_id: 'user-b',
        opponent2_id: 'user-d',
      }));

      mockQuery.mockResolvedValueOnce({ rows }).mockResolvedValueOnce({
        rows: [
          { id: 'user-b', display_name: 'Bob' },
          { id: 'user-c', display_name: 'Charlie' },
          { id: 'user-d', display_name: 'Diana' },
        ],
      });

      const stats = await getPlayerStats('user-a');
      expect(stats.recentGames).toHaveLength(5);
      expect(stats.totalGames).toBe(8);
    });

    it('should use "Unknown" for unresolved player names', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              completed_at: '2026-03-15',
              won: true,
              my_score: 510,
              opponent_score: 340,
              partner_id: 'deleted-user',
              opponent1_id: null,
              opponent2_id: 'user-d',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'user-d', display_name: 'Diana' }],
        });

      const stats = await getPlayerStats('user-a');
      expect(stats.recentGames[0].partner).toBe('Unknown');
      expect(stats.recentGames[0].opponents[0]).toBe('Unknown');
      expect(stats.recentGames[0].opponents[1]).toBe('Diana');
    });

    it('should return dev sample stats when no DATABASE_URL in dev', async () => {
      vi.stubEnv('DATABASE_URL', '');
      delete process.env.DATABASE_URL;

      const stats = await getPlayerStats('any-user');
      // Dev mode returns sample stats with totalGames > 0
      expect(stats.totalGames).toBeGreaterThan(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('getNilStats', () => {
    it('should return empty nil stats when no DATABASE_URL in production', async () => {
      vi.stubEnv('DATABASE_URL', '');
      delete process.env.DATABASE_URL;
      vi.stubEnv('NODE_ENV', 'production');

      const stats = await getNilStats('any-user');
      expect(stats.totalAttempts).toBe(0);
      expect(stats.succeeded).toBe(0);
    });

    it('should compute nil stats from query results', async () => {
      mockQuery
        // My nils query
        .mockResolvedValueOnce({
          rows: [
            {
              total: '5',
              succeeded: '3',
              blind_total: '2',
              blind_succeeded: '1',
            },
          ],
        })
        // Partner nils query
        .mockResolvedValueOnce({
          rows: [{ total: '4', succeeded: '3' }],
        });

      const stats = await getNilStats('user-a');
      expect(stats.totalAttempts).toBe(5);
      expect(stats.succeeded).toBe(3);
      expect(stats.failed).toBe(2);
      expect(stats.successRate).toBe(60);
      expect(stats.blindNilAttempts).toBe(2);
      expect(stats.blindNilSucceeded).toBe(1);
      expect(stats.blindNilSuccessRate).toBe(50);
      expect(stats.asPartner.totalAttempts).toBe(4);
      expect(stats.asPartner.succeeded).toBe(3);
      expect(stats.asPartner.failed).toBe(1);
      expect(stats.asPartner.successRate).toBe(75);
    });
  });

  describe('getBidStats', () => {
    it('should return empty bid stats when no rounds found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_rounds: '0',
            avg_bid: '0',
            avg_tricks: '0',
            met_bid: '0',
            over_bid: '0',
            under_bid: '0',
          },
        ],
      });

      const stats = await getBidStats('user-a');
      expect(stats.totalRounds).toBe(0);
    });

    it('should compute bid accuracy and rates', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_rounds: '10',
            avg_bid: '3.5',
            avg_tricks: '3.8',
            met_bid: '7',
            over_bid: '5',
            under_bid: '3',
          },
        ],
      });

      const stats = await getBidStats('user-a');
      expect(stats.totalRounds).toBe(10);
      expect(stats.averageBid).toBe(3.5);
      expect(stats.averageTricks).toBe(3.8);
      expect(stats.bidAccuracy).toBe(70); // 7/10
      expect(stats.underbidRate).toBe(50); // 5/10 (over_bid = underbid in UI terminology)
      expect(stats.setBidRate).toBe(30); // 3/10
    });
  });
});
