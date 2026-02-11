import type { GameState, GameConfig } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { validateBid as validateBidLogic } from '../game-logic/bidding.js';

export interface BidValidationResult {
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
): BidValidationResult {
  return validateBidLogic(gameState, playerId, bid, isNil, isBlindNil, config);
}

export function getValidBids(
  gameState: GameState,
  playerId: PlayerId,
  config: GameConfig
): { min: number; max: number; nilAllowed: boolean; blindNilAllowed: boolean } {
  return {
    min: 0,
    max: 13,
    nilAllowed: config.allowNil,
    blindNilAllowed: config.allowBlindNil
  };
}
