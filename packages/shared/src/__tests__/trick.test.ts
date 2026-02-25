import { describe, it, expect } from 'vitest';
import {
  determineTrickWinner,
  addPlayToTrick,
  isTrickComplete,
  hasSpadeBeenPlayedInTrick,
} from '../game-logic/trick';
import type { Trick } from '../types/game-state';

describe('Trick', () => {
  describe('determineTrickWinner', () => {
    it('should return null for incomplete tricks', () => {
      const trick: Trick = {
        plays: [{ playerId: 'p1', card: { suit: 'hearts', rank: 'A' } }],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(determineTrickWinner(trick)).toBeNull();
    });

    it('should return the player with highest card in lead suit', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: '5' } },
          { playerId: 'p2', card: { suit: 'hearts', rank: 'K' } },
          { playerId: 'p3', card: { suit: 'hearts', rank: '2' } },
          { playerId: 'p4', card: { suit: 'hearts', rank: '10' } },
        ],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(determineTrickWinner(trick)).toBe('p2');
    });

    it('should return the player with spade when spades trump', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: 'A' } },
          { playerId: 'p2', card: { suit: 'spades', rank: '2' } },
          { playerId: 'p3', card: { suit: 'hearts', rank: 'K' } },
          { playerId: 'p4', card: { suit: 'hearts', rank: 'Q' } },
        ],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(determineTrickWinner(trick)).toBe('p2');
    });

    it('should return the player with highest spade when multiple spades', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: 'A' } },
          { playerId: 'p2', card: { suit: 'spades', rank: '2' } },
          { playerId: 'p3', card: { suit: 'spades', rank: 'K' } },
          { playerId: 'p4', card: { suit: 'spades', rank: '5' } },
        ],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(determineTrickWinner(trick)).toBe('p3');
    });

    it('should ignore off-suit non-spade cards', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: '5' } },
          { playerId: 'p2', card: { suit: 'diamonds', rank: 'A' } },
          { playerId: 'p3', card: { suit: 'hearts', rank: '7' } },
          { playerId: 'p4', card: { suit: 'clubs', rank: 'K' } },
        ],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(determineTrickWinner(trick)).toBe('p3');
    });
  });

  describe('addPlayToTrick', () => {
    it('should add play to empty trick and set lead suit', () => {
      const trick: Trick = { plays: [], leadSuit: null, winner: null };
      const result = addPlayToTrick(trick, {
        playerId: 'p1',
        card: { suit: 'hearts', rank: 'A' },
      });

      expect(result.plays).toHaveLength(1);
      expect(result.leadSuit).toBe('hearts');
      expect(result.winner).toBeNull();
    });

    it('should set winner when trick is complete', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: '5' } },
          { playerId: 'p2', card: { suit: 'hearts', rank: 'K' } },
          { playerId: 'p3', card: { suit: 'hearts', rank: '2' } },
        ],
        leadSuit: 'hearts',
        winner: null,
      };

      const result = addPlayToTrick(trick, {
        playerId: 'p4',
        card: { suit: 'hearts', rank: '10' },
      });

      expect(result.plays).toHaveLength(4);
      expect(result.winner).toBe('p2');
    });
  });

  describe('isTrickComplete', () => {
    it('should return false for incomplete trick', () => {
      const trick: Trick = {
        plays: [{ playerId: 'p1', card: { suit: 'hearts', rank: 'A' } }],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(isTrickComplete(trick)).toBe(false);
    });

    it('should return true for complete trick', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: '5' } },
          { playerId: 'p2', card: { suit: 'hearts', rank: 'K' } },
          { playerId: 'p3', card: { suit: 'hearts', rank: '2' } },
          { playerId: 'p4', card: { suit: 'hearts', rank: '10' } },
        ],
        leadSuit: 'hearts',
        winner: 'p2',
      };
      expect(isTrickComplete(trick)).toBe(true);
    });
  });

  describe('hasSpadeBeenPlayedInTrick', () => {
    it('should return false if no spades played', () => {
      const trick: Trick = {
        plays: [{ playerId: 'p1', card: { suit: 'hearts', rank: 'A' } }],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(hasSpadeBeenPlayedInTrick(trick)).toBe(false);
    });

    it('should return true if spade was played', () => {
      const trick: Trick = {
        plays: [
          { playerId: 'p1', card: { suit: 'hearts', rank: 'A' } },
          { playerId: 'p2', card: { suit: 'spades', rank: '2' } },
        ],
        leadSuit: 'hearts',
        winner: null,
      };
      expect(hasSpadeBeenPlayedInTrick(trick)).toBe(true);
    });
  });
});
