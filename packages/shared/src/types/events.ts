import type { Card } from './card.js';
import type { GameState } from './game-state.js';
import type { RoundEffect } from './mod.js';
import type { PlayerId, Position } from './player.js';

// Client -> Server Events
export interface ClientToServerEvents {
  'room:create': (data: { nickname: string }) => void;
  'room:join': (data: { roomId: string; nickname: string }) => void;
  'room:ready': () => void;
  'room:leave': () => void;
  'game:bid': (data: {
    bid: number;
    isNil?: boolean;
    isBlindNil?: boolean;
  }) => void;
  'game:play-card': (data: { card: Card }) => void;
  'player:reconnect': (data: { sessionToken: string; roomId: string }) => void;
  'player:change-seat': (data: { newPosition: Position }) => void;
  'player:open-seat': (data: { playerId: PlayerId }) => void;
  'room:select-seat': (data: {
    roomId: string;
    position: Position;
    nickname: string;
  }) => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; sessionToken: string }) => void;
  'room:joined': (data: {
    roomId: string;
    position: Position;
    sessionToken: string;
  }) => void;
  'room:player-joined': (data: {
    playerId: PlayerId;
    nickname: string;
    position: Position;
  }) => void;
  'room:player-left': (data: { playerId: PlayerId }) => void;
  'room:player-ready': (data: { playerId: PlayerId }) => void;
  'room:player-reconnected': (data: { playerId: PlayerId }) => void;
  'room:player-disconnected': (data: { playerId: PlayerId }) => void;
  'game:started': () => void;
  'game:state-update': (data: { state: ClientGameState }) => void;
  'game:cards-dealt': (data: { hand: Card[] }) => void;
  'game:bid-made': (data: {
    playerId: PlayerId;
    bid: number;
    isNil: boolean;
    isBlindNil: boolean;
  }) => void;
  'game:card-played': (data: { playerId: PlayerId; card: Card }) => void;
  'game:trick-won': (data: { winnerId: PlayerId; trickNumber: number }) => void;
  'game:round-end': (data: {
    scores: GameState['scores'];
    roundSummary: RoundSummary;
    effects?: RoundEffect[];
    scoreHistory: ScoreHistoryEntry[];
  }) => void;
  'game:ended': (data: {
    winningTeam: 'team1' | 'team2';
    finalScores: GameState['scores'];
    scoreHistory: ScoreHistoryEntry[];
  }) => void;
  'game:team-names': (data: {
    team1: string;
    team2: string;
    startButton?: string;
  }) => void;
  'game:summary': (data: { summary: string }) => void;
  error: (data: { code: string; message: string }) => void;
  'reconnect:success': (data: {
    state: ClientGameState;
    hand: Card[];
    scoreHistory: ScoreHistoryEntry[];
  }) => void;
  'reconnect:failed': (data: { reason: string }) => void;
  'room:seat-changed': (data: { newPosition: Position }) => void;
  'room:seats-available': (data: {
    roomId: string;
    seats: {
      position: Position;
      team: 'team1' | 'team2';
      previousNickname: string;
    }[];
  }) => void;
  'room:seat-opened': (data: {
    playerId: PlayerId;
    position: Position;
  }) => void;
}

// Client-safe game state (hides other players' hands)
export interface ClientGameState {
  id: string;
  phase: GameState['phase'];
  players: {
    id: PlayerId;
    nickname: string;
    position: Position;
    team: 'team1' | 'team2';
    cardCount: number;
    connected: boolean;
    ready: boolean;
    openForReplacement?: boolean;
  }[];
  scores: GameState['scores'];
  currentRound: {
    roundNumber: number;
    bids: {
      playerId: PlayerId;
      bid: number;
      isNil: boolean;
      isBlindNil: boolean;
    }[];
    currentTrick: {
      plays: { playerId: PlayerId; card: Card }[];
      leadSuit: Card['suit'] | null;
    };
    tricksWon: Record<PlayerId, number>;
    spadesBroken: boolean;
  } | null;
  dealerPosition: Position;
  currentPlayerPosition: Position;
  winningScore: number;
  disabledBids?: number[];
  teamNames?: { team1: string; team2: string };
}

export interface ScoreHistoryEntry {
  round: number;
  team1Score: number;
  team2Score: number;
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
  bagPenalty: number;
  nilResults: {
    playerId: PlayerId;
    isBlindNil: boolean;
    succeeded: boolean;
    points: number;
  }[];
}
