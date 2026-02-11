import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  removeCardFromHand,
  hasCard,
  hasSuit,
  getCardsOfSuit,
  hasOnlySpades
} from '../game-logic/deck';
import type { Card } from '../types/card';

describe('Deck', () => {
  describe('createDeck', () => {
    it('should create a 52-card deck', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
    });

    it('should have 13 cards of each suit', () => {
      const deck = createDeck();
      const spades = deck.filter(c => c.suit === 'spades');
      const hearts = deck.filter(c => c.suit === 'hearts');
      const diamonds = deck.filter(c => c.suit === 'diamonds');
      const clubs = deck.filter(c => c.suit === 'clubs');

      expect(spades).toHaveLength(13);
      expect(hearts).toHaveLength(13);
      expect(diamonds).toHaveLength(13);
      expect(clubs).toHaveLength(13);
    });
  });

  describe('shuffleDeck', () => {
    it('should return a deck with 52 cards', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).toHaveLength(52);
    });

    it('should not modify the original deck', () => {
      const deck = createDeck();
      const original = [...deck];
      shuffleDeck(deck);
      expect(deck).toEqual(original);
    });

    it('should change the order of cards', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      // It's possible but extremely unlikely for a shuffled deck to match
      const matches = deck.filter((c, i) =>
        c.suit === shuffled[i].suit && c.rank === shuffled[i].rank
      );
      expect(matches.length).toBeLessThan(52);
    });
  });

  describe('dealCards', () => {
    it('should deal 13 cards to each of 4 players', () => {
      const deck = createDeck();
      const hands = dealCards(deck);

      expect(hands).toHaveLength(4);
      hands.forEach(hand => {
        expect(hand).toHaveLength(13);
      });
    });

    it('should distribute all unique cards', () => {
      const deck = createDeck();
      const hands = dealCards(deck);
      const allCards = hands.flat();

      expect(allCards).toHaveLength(52);

      const uniqueCards = new Set(allCards.map(c => `${c.suit}-${c.rank}`));
      expect(uniqueCards.size).toBe(52);
    });
  });

  describe('sortHand', () => {
    it('should sort by suit then rank', () => {
      const hand: Card[] = [
        { suit: 'hearts', rank: '5' },
        { suit: 'spades', rank: 'A' },
        { suit: 'spades', rank: '2' },
        { suit: 'clubs', rank: 'K' }
      ];

      const sorted = sortHand(hand);

      // Suit order: spades, hearts, clubs, diamonds
      // Rank order within suit: high to low (A, K, Q, ..., 2)
      expect(sorted[0]).toEqual({ suit: 'spades', rank: 'A' });
      expect(sorted[1]).toEqual({ suit: 'spades', rank: '2' });
      expect(sorted[2]).toEqual({ suit: 'hearts', rank: '5' });
      expect(sorted[3]).toEqual({ suit: 'clubs', rank: 'K' });
    });
  });

  describe('removeCardFromHand', () => {
    it('should remove the specified card', () => {
      const hand: Card[] = [
        { suit: 'spades', rank: 'A' },
        { suit: 'hearts', rank: 'K' },
        { suit: 'diamonds', rank: 'Q' }
      ];

      const result = removeCardFromHand(hand, { suit: 'hearts', rank: 'K' });

      expect(result).toHaveLength(2);
      expect(result).not.toContainEqual({ suit: 'hearts', rank: 'K' });
    });

    it('should return the same array if card not found', () => {
      const hand: Card[] = [{ suit: 'spades', rank: 'A' }];
      const result = removeCardFromHand(hand, { suit: 'hearts', rank: 'K' });
      expect(result).toEqual(hand);
    });
  });

  describe('hasCard', () => {
    it('should return true if card exists', () => {
      const hand: Card[] = [{ suit: 'spades', rank: 'A' }];
      expect(hasCard(hand, { suit: 'spades', rank: 'A' })).toBe(true);
    });

    it('should return false if card does not exist', () => {
      const hand: Card[] = [{ suit: 'spades', rank: 'A' }];
      expect(hasCard(hand, { suit: 'hearts', rank: 'K' })).toBe(false);
    });
  });

  describe('hasSuit', () => {
    it('should return true if hand has cards of the suit', () => {
      const hand: Card[] = [
        { suit: 'spades', rank: 'A' },
        { suit: 'hearts', rank: 'K' }
      ];
      expect(hasSuit(hand, 'spades')).toBe(true);
    });

    it('should return false if hand has no cards of the suit', () => {
      const hand: Card[] = [{ suit: 'spades', rank: 'A' }];
      expect(hasSuit(hand, 'hearts')).toBe(false);
    });
  });

  describe('getCardsOfSuit', () => {
    it('should return all cards of the specified suit', () => {
      const hand: Card[] = [
        { suit: 'spades', rank: 'A' },
        { suit: 'spades', rank: 'K' },
        { suit: 'hearts', rank: 'Q' }
      ];

      const spades = getCardsOfSuit(hand, 'spades');
      expect(spades).toHaveLength(2);
      expect(spades).toContainEqual({ suit: 'spades', rank: 'A' });
      expect(spades).toContainEqual({ suit: 'spades', rank: 'K' });
    });
  });

  describe('hasOnlySpades', () => {
    it('should return true if hand only has spades', () => {
      const hand: Card[] = [
        { suit: 'spades', rank: 'A' },
        { suit: 'spades', rank: 'K' }
      ];
      expect(hasOnlySpades(hand)).toBe(true);
    });

    it('should return false if hand has other suits', () => {
      const hand: Card[] = [
        { suit: 'spades', rank: 'A' },
        { suit: 'hearts', rank: 'K' }
      ];
      expect(hasOnlySpades(hand)).toBe(false);
    });
  });
});
