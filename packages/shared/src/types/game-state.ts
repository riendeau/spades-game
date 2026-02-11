import type { Card } from './card.js';
import type { Player, PlayerId, PlayerBid, PlayerTrickPlay, TeamScore, Position } from './player.js';

export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'dealing'
  | 'bidding'
  | 'playing'
  | 'trick-end'
  | 'round-end'
  | 'game-end';

export interface Trick {
  plays: PlayerTrickPlay[];
  leadSuit: Card['suit'] | null;
  winner: PlayerId | null;
}

export interface RoundState {
  roundNumber: number;
  bids: PlayerBid[];
  tricks: Trick[];
  currentTrick: Trick;
  spadesBroken: boolean;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  scores: Record<'team1' | 'team2', TeamScore>;
  currentRound: RoundState | null;
  dealerPosition: Position;
  currentPlayerPosition: Position;
  winningScore: number;
  createdAt: number;
  lastActivity: number;
}

export interface GameConfig {
  winningScore: number;
  allowNil: boolean;
  allowBlindNil: boolean;
  bagPenaltyThreshold: number;
  bagPenalty: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  winningScore: 500,
  allowNil: true,
  allowBlindNil: true,
  bagPenaltyThreshold: 10,
  bagPenalty: 100
};

export function createInitialGameState(id: string): GameState {
  return {
    id,
    phase: 'waiting',
    players: [],
    scores: {
      team1: { teamId: 'team1', score: 0, bags: 0, roundBid: 0, roundTricks: 0 },
      team2: { teamId: 'team2', score: 0, bags: 0, roundBid: 0, roundTricks: 0 }
    },
    currentRound: null,
    dealerPosition: 0,
    currentPlayerPosition: 1,
    winningScore: DEFAULT_GAME_CONFIG.winningScore,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
}

export function createEmptyTrick(): Trick {
  return {
    plays: [],
    leadSuit: null,
    winner: null
  };
}

export function createRoundState(roundNumber: number): RoundState {
  return {
    roundNumber,
    bids: [],
    tricks: [],
    currentTrick: createEmptyTrick(),
    spadesBroken: false
  };
}
