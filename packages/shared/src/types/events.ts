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
  'game:see-cards': () => void;
  'player:reconnect': (data: {
    sessionToken: string;
    roomId: string;
    // The round number in which this seat clicked See Cards, as remembered by
    // the client. `game:see-cards` is fire-and-forget, so it can be lost
    // outright on a half-open socket, or arrive on the reconnected socket
    // *before* player:reconnect has attached a session to it (socket.io
    // flushes buffered packets ahead of the 'connect' listener). Re-asserting
    // it here lets the server recover the seat's `hasViewedCards` flag instead
    // of offering back a Bid Blind Nil the player already forfeited. The
    // server only ever uses it to set the flag, never to clear it.
    viewedRound?: number;
  }) => void;
  // Log-only debug relay for reconnect/replace observability. The server logs
  // these verbatim (no state mutation), correlated by sessionToken with the
  // existing [reconnect]/[session] lines. See handleClientDebug.
  'client:debug': (data: {
    event: string;
    sessionToken?: string;
    roomId?: string;
    reason?: string;
  }) => void;
  'player:change-seat': (data: { newPosition: Position }) => void;
  'player:open-seat': (data: { playerId: PlayerId }) => void;
  'player:kick-idle': (data: { playerId: PlayerId }) => void;
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
  'game:cards-dealt': (data: { hand: Card[]; autoReveal?: boolean }) => void;
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
    // roomId/position let the client rebuild its session identity after a full
    // page reload, where the in-memory store starts empty and `room:joined`
    // never fires again. On a socket-level blip they're simply re-set to the
    // values already in the store.
    roomId: string;
    position: Position;
    state: ClientGameState;
    hand: Card[];
    // Same semantics as on game:cards-dealt: true when the seat has no
    // See Cards / Bid Blind Nil decision left to make this round.
    autoReveal?: boolean;
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
  'player:kicked-for-idle': () => void;
}

// Client-safe game state (hides other players' hands)
export interface ClientGameState {
  id: string;
  phase: GameState['phase'];
  players: {
    id: PlayerId;
    nickname: string;
    pictureUrl: string | null;
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
  turnStartedAt: number | null;
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
