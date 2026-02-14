import type { Card } from '../types/card.js';
import { compareCards, RANK_VALUES } from '../types/card.js';
import type { Trick } from '../types/game-state.js';
import type { PlayerId, PlayerTrickPlay } from '../types/player.js';

export function determineTrickWinner(trick: Trick): PlayerId | null {
  if (trick.plays.length !== 4 || !trick.leadSuit) {
    return null;
  }

  let winningPlay = trick.plays[0];

  for (let i = 1; i < trick.plays.length; i++) {
    const currentPlay = trick.plays[i];
    if (compareCards(currentPlay.card, winningPlay.card, trick.leadSuit) > 0) {
      winningPlay = currentPlay;
    }
  }

  return winningPlay.playerId;
}

export function addPlayToTrick(trick: Trick, play: PlayerTrickPlay): Trick {
  const newPlays = [...trick.plays, play];
  const leadSuit = trick.leadSuit ?? play.card.suit;

  return {
    plays: newPlays,
    leadSuit,
    winner:
      newPlays.length === 4
        ? determineTrickWinner({ ...trick, plays: newPlays, leadSuit })
        : null,
  };
}

export function isTrickComplete(trick: Trick): boolean {
  return trick.plays.length === 4;
}

export function getHighestCardInTrick(trick: Trick): Card | null {
  if (trick.plays.length === 0 || !trick.leadSuit) return null;

  let highest = trick.plays[0].card;
  for (let i = 1; i < trick.plays.length; i++) {
    if (compareCards(trick.plays[i].card, highest, trick.leadSuit) > 0) {
      highest = trick.plays[i].card;
    }
  }
  return highest;
}

export function hasSpadeBeenPlayedInTrick(trick: Trick): boolean {
  return trick.plays.some((p) => p.card.suit === 'spades');
}
