import type { Card } from './card.js';
import type { GameState } from './game-state.js';
import type { PlayerId, Position } from './player.js';

// Client -> Server Events
export interface ClientToServerEvents {
  'room:create': (data: { nickname: string }) => void;
  'room:join': (data: { roomId: string; nickname: string }) => void;
  'room:ready': () => void;
  'room:leave': () => void;
  'game:bid': (data: { bid: number; isNil?: boolean; isBlindNil?: boolean }) => void;
  'game:play-card': (data: { card: Card }) => void;
  'player:reconnect': (data: { sessionToken: string; roomId: string }) => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; sessionToken: string }) => void;
  'room:joined': (data: { roomId: string; position: Position; sessionToken: string }) => void;
  'room:player-joined': (data: { playerId: PlayerId; nickname: string; position: Position }) => void;
  'room:player-left': (data: { playerId: PlayerId }) => void;
  'room:player-ready': (data: { playerId: PlayerId }) => void;
  'room:player-reconnected': (data: { playerId: PlayerId }) => void;
  'room:player-disconnected': (data: { playerId: PlayerId }) => void;
  'game:started': () => void;
  'game:state-update': (data: { state: ClientGameState }) => void;
  'game:cards-dealt': (data: { hand: Card[] }) => void;
  'game:bid-made': (data: { playerId: PlayerId; bid: number; isNil: boolean; isBlindNil: boolean }) => void;
  'game:card-played': (data: { playerId: PlayerId; card: Card }) => void;
  'game:trick-won': (data: { winnerId: PlayerId; trickNumber: number }) => void;
  'game:round-end': (data: { scores: GameState['scores']; roundSummary: RoundSummary }) => void;
  'game:ended': (data: { winningTeam: 'team1' | 'team2'; finalScores: GameState['scores'] }) => void;
  'error': (data: { code: string; message: string }) => void;
  'reconnect:success': (data: { state: ClientGameState; hand: Card[] }) => void;
  'reconnect:failed': (data: { reason: string }) => void;
}

// Client-safe game state (hides other players' hands)
export interface ClientGameState {
  id: string;
  phase: GameState['phase'];
  players: Array<{
    id: PlayerId;
    nickname: string;
    position: Position;
    team: 'team1' | 'team2';
    cardCount: number;
    connected: boolean;
    ready: boolean;
  }>;
  scores: GameState['scores'];
  currentRound: {
    roundNumber: number;
    bids: Array<{ playerId: PlayerId; bid: number; isNil: boolean; isBlindNil: boolean }>;
    currentTrick: {
      plays: Array<{ playerId: PlayerId; card: Card }>;
      leadSuit: Card['suit'] | null;
    };
    tricksWon: Record<PlayerId, number>;
    spadesBroken: boolean;
  } | null;
  dealerPosition: Position;
  currentPlayerPosition: Position;
}

export interface RoundSummary {
  roundNumber: number;
  team1: TeamRoundResult;
  team2: TeamRoundResult;
}

export interface TeamRoundResult {
  bid: number;
  tricks: number;
  points: number;
  bags: number;
  bagPenalty: boolean;
  nilResults: Array<{
    playerId: PlayerId;
    isBlindNil: boolean;
    succeeded: boolean;
    points: number;
  }>;
}
