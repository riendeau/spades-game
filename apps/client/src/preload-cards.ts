import type { Rank, Suit } from '@spades/shared';

const RANK_NAMES: Record<Rank, string> = {
  A: 'ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS: Rank[] = [
  'A',
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
];

export const preloadedCardUrls = new Set<string>();

export function preloadCardImages(): void {
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const url = `/cards/${RANK_NAMES[rank]}_of_${suit}.svg`;
      if (!preloadedCardUrls.has(url)) {
        preloadedCardUrls.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }
}
