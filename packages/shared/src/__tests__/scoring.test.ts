import { describe, it, expect } from 'vitest';
import {
  calculateRoundScore,
  updateTeamScore,
  checkGameEnd
} from '../game-logic/scoring';
import { DEFAULT_GAME_CONFIG } from '../types/game-state';
import type { TeamScore, PlayerBid } from '../types/player';

describe('Scoring', () => {
  describe('calculateRoundScore', () => {
    it('should score 10 points per bid when making bid exactly', () => {
      const result = calculateRoundScore(4, 4, [], {}, DEFAULT_GAME_CONFIG);
      expect(result.baseScore).toBe(40);
      expect(result.bags).toBe(0);
    });

    it('should add bags when exceeding bid', () => {
      const result = calculateRoundScore(4, 6, [], {}, DEFAULT_GAME_CONFIG);
      expect(result.baseScore).toBe(40);
      expect(result.bags).toBe(2);
    });

    it('should score negative when set (under bid)', () => {
      const result = calculateRoundScore(5, 3, [], {}, DEFAULT_GAME_CONFIG);
      expect(result.baseScore).toBe(-50);
      expect(result.bags).toBe(0);
    });

    it('should award 100 points for successful nil', () => {
      const nilBids: PlayerBid[] = [
        { playerId: 'p1', bid: 0, isNil: true, isBlindNil: false }
      ];
      const playerTricks = { p1: 0 };

      const result = calculateRoundScore(0, 0, nilBids, playerTricks, DEFAULT_GAME_CONFIG);
      expect(result.nilBonus).toBe(100);
    });

    it('should penalize 100 points for failed nil', () => {
      const nilBids: PlayerBid[] = [
        { playerId: 'p1', bid: 0, isNil: true, isBlindNil: false }
      ];
      const playerTricks = { p1: 2 };

      const result = calculateRoundScore(0, 2, nilBids, playerTricks, DEFAULT_GAME_CONFIG);
      expect(result.nilBonus).toBe(-100);
    });

    it('should award 200 points for successful blind nil', () => {
      const nilBids: PlayerBid[] = [
        { playerId: 'p1', bid: 0, isNil: false, isBlindNil: true }
      ];
      const playerTricks = { p1: 0 };

      const result = calculateRoundScore(0, 0, nilBids, playerTricks, DEFAULT_GAME_CONFIG);
      expect(result.nilBonus).toBe(200);
    });

    it('should penalize 200 points for failed blind nil', () => {
      const nilBids: PlayerBid[] = [
        { playerId: 'p1', bid: 0, isNil: false, isBlindNil: true }
      ];
      const playerTricks = { p1: 1 };

      const result = calculateRoundScore(0, 1, nilBids, playerTricks, DEFAULT_GAME_CONFIG);
      expect(result.nilBonus).toBe(-200);
    });
  });

  describe('updateTeamScore', () => {
    it('should add round score to total', () => {
      const current: TeamScore = {
        teamId: 'team1',
        score: 100,
        bags: 3,
        roundBid: 0,
        roundTricks: 0
      };

      const roundCalc = {
        baseScore: 50,
        bags: 2,
        bagPenalty: 0,
        nilBonus: 0,
        totalScore: 50
      };

      const result = updateTeamScore(current, roundCalc, DEFAULT_GAME_CONFIG);
      expect(result.score).toBe(150);
      expect(result.bags).toBe(5);
    });

    it('should apply bag penalty at 10 bags', () => {
      const current: TeamScore = {
        teamId: 'team1',
        score: 200,
        bags: 8,
        roundBid: 0,
        roundTricks: 0
      };

      const roundCalc = {
        baseScore: 50,
        bags: 3,
        bagPenalty: 0,
        nilBonus: 0,
        totalScore: 50
      };

      const result = updateTeamScore(current, roundCalc, DEFAULT_GAME_CONFIG);
      // 200 + 50 - 100 (penalty) = 150
      expect(result.score).toBe(150);
      // 11 bags - 10 = 1 overflow
      expect(result.bags).toBe(1);
    });
  });

  describe('checkGameEnd', () => {
    it('should return null if no team reached winning score', () => {
      const scores = {
        team1: { teamId: 'team1' as const, score: 400, bags: 0, roundBid: 0, roundTricks: 0 },
        team2: { teamId: 'team2' as const, score: 300, bags: 0, roundBid: 0, roundTricks: 0 }
      };
      expect(checkGameEnd(scores, 500)).toBeNull();
    });

    it('should return team1 if they reach winning score first', () => {
      const scores = {
        team1: { teamId: 'team1' as const, score: 520, bags: 0, roundBid: 0, roundTricks: 0 },
        team2: { teamId: 'team2' as const, score: 400, bags: 0, roundBid: 0, roundTricks: 0 }
      };
      expect(checkGameEnd(scores, 500)).toBe('team1');
    });

    it('should return team with higher score if both over winning score', () => {
      const scores = {
        team1: { teamId: 'team1' as const, score: 520, bags: 0, roundBid: 0, roundTricks: 0 },
        team2: { teamId: 'team2' as const, score: 550, bags: 0, roundBid: 0, roundTricks: 0 }
      };
      expect(checkGameEnd(scores, 500)).toBe('team2');
    });
  });
});
