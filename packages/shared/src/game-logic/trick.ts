import { compareCards } from '../types/card.js';
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
