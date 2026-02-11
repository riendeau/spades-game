import type { Card } from '../types/card.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { hasSuit, hasOnlySpades } from '../game-logic/deck.js';

export interface PlayValidationResult {
  valid: boolean;
  errorMessage?: string;
}

export function validatePlay(
  gameState: GameState,
  playerId: PlayerId,
  card: Card,
  playerHand: Card[]
): PlayValidationResult {
  // Check if it's playing phase
  if (gameState.phase !== 'playing') {
    return { valid: false, errorMessage: 'Not in playing phase' };
  }

  // Check if player exists and it's their turn
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return { valid: false, errorMessage: 'Player not found' };
  }

  if (player.position !== gameState.currentPlayerPosition) {
    return { valid: false, errorMessage: 'Not your turn to play' };
  }

  // Check if player has the card
  const hasCardInHand = playerHand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!hasCardInHand) {
    return { valid: false, errorMessage: 'Card not in hand' };
  }

  const currentTrick = gameState.currentRound?.currentTrick;
  if (!currentTrick) {
    return { valid: false, errorMessage: 'No current trick' };
  }

  // If leading the trick
  if (currentTrick.plays.length === 0) {
    // Cannot lead with spades unless spades are broken or only have spades
    if (card.suit === 'spades') {
      if (!gameState.currentRound?.spadesBroken && !hasOnlySpades(playerHand)) {
        return { valid: false, errorMessage: 'Cannot lead with spades until broken' };
      }
    }
    return { valid: true };
  }

  // Must follow lead suit if possible
  const leadSuit = currentTrick.leadSuit!;
  if (card.suit !== leadSuit && hasSuit(playerHand, leadSuit)) {
    return { valid: false, errorMessage: `Must follow suit (${leadSuit})` };
  }

  return { valid: true };
}

export function getPlayableCards(
  gameState: GameState,
  playerId: PlayerId,
  playerHand: Card[]
): Card[] {
  return playerHand.filter(card => {
    const result = validatePlay(gameState, playerId, card, playerHand);
    return result.valid;
  });
}
