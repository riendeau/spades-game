export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

export function parseCard(str: string): Card | null {
  const match = /^(10|[2-9JQKA])([SHDC])$/i.exec(str);
  if (!match) return null;

  const rankMap: Record<string, Rank> = {
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    J: 'J',
    Q: 'Q',
    K: 'K',
    A: 'A',
  };
  const suitMap: Record<string, Suit> = {
    S: 'spades',
    H: 'hearts',
    D: 'diamonds',
    C: 'clubs',
  };

  return {
    rank: rankMap[match[1].toUpperCase()],
    suit: suitMap[match[2].toUpperCase()],
  };
}

export function compareCards(a: Card, b: Card, leadSuit: Suit): number {
  const aIsSpade = a.suit === 'spades';
  const bIsSpade = b.suit === 'spades';
  const aFollowsLead = a.suit === leadSuit;
  const bFollowsLead = b.suit === leadSuit;

  // Spades trump everything
  if (aIsSpade && !bIsSpade) return 1;
  if (bIsSpade && !aIsSpade) return -1;

  // If both spades, compare ranks
  if (aIsSpade && bIsSpade) {
    return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
  }

  // Following lead beats off-suit
  if (aFollowsLead && !bFollowsLead) return 1;
  if (bFollowsLead && !aFollowsLead) return -1;

  // Same suit, compare ranks
  if (a.suit === b.suit) {
    return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
  }

  // Neither follows lead and neither is spades - first card wins (a)
  return 0;
}
