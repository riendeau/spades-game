import type { GameState, GameConfig } from '../types/game-state.js';
import type { PlayerId, PlayerBid, Position } from '../types/player.js';

export interface BidResult {
  valid: boolean;
  errorMessage?: string;
}

export function validateBid(
  gameState: GameState,
  playerId: PlayerId,
  bid: number,
  isNil: boolean,
  isBlindNil: boolean,
  config: GameConfig
): BidResult {
  // Check if it's bidding phase
  if (gameState.phase !== 'bidding') {
    return { valid: false, errorMessage: 'Not in bidding phase' };
  }

  // Check if player exists and it's their turn
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return { valid: false, errorMessage: 'Player not found' };
  }

  if (player.position !== gameState.currentPlayerPosition) {
    return { valid: false, errorMessage: 'Not your turn to bid' };
  }

  // Check if player already bid
  const existingBid = gameState.currentRound?.bids.find(b => b.playerId === playerId);
  if (existingBid) {
    return { valid: false, errorMessage: 'Player already bid' };
  }

  // Validate nil options
  if (isNil && !config.allowNil) {
    return { valid: false, errorMessage: 'Nil bids not allowed' };
  }

  if (isBlindNil && !config.allowBlindNil) {
    return { valid: false, errorMessage: 'Blind nil bids not allowed' };
  }

  if (isBlindNil && gameState.currentRound?.bids.length !== 0) {
    // Blind nil can only be bid before looking at cards (first bid)
    // In practice, we allow it anytime but it's typically a house rule
  }

  // Validate bid range
  if (isNil || isBlindNil) {
    if (bid !== 0) {
      return { valid: false, errorMessage: 'Nil bid must be 0' };
    }
  } else {
    if (bid < 0 || bid > 13) {
      return { valid: false, errorMessage: 'Bid must be between 0 and 13' };
    }
  }

  return { valid: true };
}

export function getNextBidder(gameState: GameState): Position {
  const bidsCount = gameState.currentRound?.bids.length || 0;
  // Bidding starts to dealer's left and goes clockwise
  return ((gameState.dealerPosition + 1 + bidsCount) % 4) as Position;
}

export function allBidsComplete(gameState: GameState): boolean {
  return (gameState.currentRound?.bids.length || 0) === 4;
}

export function createBid(
  playerId: PlayerId,
  bid: number,
  isNil: boolean,
  isBlindNil: boolean
): PlayerBid {
  return {
    playerId,
    bid: isNil || isBlindNil ? 0 : bid,
    isNil,
    isBlindNil
  };
}

export function getTeamTotalBid(bids: PlayerBid[], playerIds: PlayerId[]): number {
  return bids
    .filter(b => playerIds.includes(b.playerId) && !b.isNil && !b.isBlindNil)
    .reduce((sum, b) => sum + b.bid, 0);
}
