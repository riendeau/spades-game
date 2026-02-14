import type { Card, Suit, Rank } from '../types/card.js';
import { SUITS, RANKS } from '../types/card.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[], numPlayers = 4): Card[][] {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  const shuffled = shuffleDeck(deck);

  for (let i = 0; i < shuffled.length; i++) {
    hands[i % numPlayers].push(shuffled[i]);
  }

  // Sort each hand by suit then rank
  return hands.map(sortHand);
}

export function sortHand(hand: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    spades: 0,
    hearts: 1,
    clubs: 2,
    diamonds: 3,
  };

  const rankOrder: Record<Rank, number> = {
    A: 14,
    K: 13,
    Q: 12,
    J: 11,
    '10': 10,
    '9': 9,
    '8': 8,
    '7': 7,
    '6': 6,
    '5': 5,
    '4': 4,
    '3': 3,
    '2': 2,
  };

  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return rankOrder[b.rank] - rankOrder[a.rank];
  });
}

export function removeCardFromHand(hand: Card[], card: Card): Card[] {
  const index = hand.findIndex(
    (c) => c.suit === card.suit && c.rank === card.rank
  );
  if (index === -1) return hand;
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

export function hasCard(hand: Card[], card: Card): boolean {
  return hand.some((c) => c.suit === card.suit && c.rank === card.rank);
}

export function hasSuit(hand: Card[], suit: Suit): boolean {
  return hand.some((c) => c.suit === suit);
}

export function getCardsOfSuit(hand: Card[], suit: Suit): Card[] {
  return hand.filter((c) => c.suit === suit);
}

export function hasOnlySpades(hand: Card[]): boolean {
  return hand.every((c) => c.suit === 'spades');
}
