import type { Card, Rank } from '@spades/shared';
import { RANKS, SUITS } from '@spades/shared';

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

export function getCardImageUrl(card: Card): string {
  return `/cards/${RANK_NAMES[card.rank]}_of_${card.suit}.svg`;
}

export const preloadedCardUrls = new Set<string>();

export function preloadCardImages(): void {
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const url = getCardImageUrl({ rank, suit });
      if (!preloadedCardUrls.has(url)) {
        preloadedCardUrls.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }
}
