import { hasSuit, hasOnlySpades } from '../game-logic/deck.js';
import type { Card } from '../types/card.js';
import type { PlayerId } from '../types/player.js';

/**
 * Minimal game state interface for play validation.
 * Both server-side GameState and ClientGameState satisfy this structurally.
 */
export interface PlayValidationGameState {
  phase: string;
  players: { id: PlayerId; position: number }[];
  currentPlayerPosition: number;
  currentRound: {
    currentTrick: {
      plays: { playerId: PlayerId; card: Card }[];
      leadSuit: Card['suit'] | null;
    };
    spadesBroken: boolean;
  } | null;
}

export interface PlayValidationResult {
  valid: boolean;
  errorMessage?: string;
}

export function validatePlay(
  gameState: PlayValidationGameState,
  playerId: PlayerId,
  card: Card,
  playerHand: Card[]
): PlayValidationResult {
  // Check if it's playing phase
  if (gameState.phase !== 'playing') {
    return { valid: false, errorMessage: 'Not in playing phase' };
  }

  // Check if player exists and it's their turn
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return { valid: false, errorMessage: 'Player not found' };
  }

  if (player.position !== gameState.currentPlayerPosition) {
    return { valid: false, errorMessage: 'Not your turn to play' };
  }

  // Check if player has the card
  const hasCardInHand = playerHand.some(
    (c) => c.suit === card.suit && c.rank === card.rank
  );
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
        return {
          valid: false,
          errorMessage: 'Cannot lead with spades until broken',
        };
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
  gameState: PlayValidationGameState,
  playerId: PlayerId,
  playerHand: Card[]
): Card[] {
  return playerHand.filter((card) => {
    const result = validatePlay(gameState, playerId, card, playerHand);
    return result.valid;
  });
}
