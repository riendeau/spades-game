import type {
  Card,
  ClientGameState,
  Position,
  RoundEffect,
  RoundSummary,
  ScoreHistoryEntry,
} from '@spades/shared';
import { create } from 'zustand';

export interface AvailableSeat {
  position: Position;
  team: 'team1' | 'team2';
  previousNickname: string;
}

interface GameStore {
  // Session state
  roomId: string | null;
  sessionToken: string | null;
  myPosition: Position | null;
  nickname: string | null;

  // Game state
  gameState: ClientGameState | null;
  myHand: Card[];

  // UI state
  lastTrickWinner: string | null;
  roundSummary: RoundSummary | null;
  roundEffects: RoundEffect[];
  scoreHistory: ScoreHistoryEntry[];
  error: string | null;
  gameEnded: {
    winner: 'team1' | 'team2';
    scores: ClientGameState['scores'];
    scoreHistory: ScoreHistoryEntry[];
    teamNames?: { team1: string; team2: string };
  } | null;
  gameSummary: string | null;
  teamNameReveal: {
    players: { nickname: string; team: 'team1' | 'team2' }[];
    teamNames: { team1: string; team2: string; startButton?: string } | null;
  } | null;
  cardsRevealed: boolean;
  availableSeats: AvailableSeat[] | null;
  seatSelectRoomId: string | null;
  kickedForIdle: boolean;
  // True while a saved session from a previous page load is being reattached.
  // Seeded synchronously at store creation (before the first render) so a
  // mid-game reload never flashes the lobby on its way back to the table.
  restoringSession: boolean;

  // Actions
  setSession: (
    roomId: string,
    sessionToken: string,
    position: Position
  ) => void;
  setNickname: (nickname: string) => void;
  setGameState: (state: ClientGameState) => void;
  setHand: (hand: Card[]) => void;
  removeCard: (card: Card) => void;
  setTrickWinner: (winnerId: string) => void;
  clearTrickWinner: () => void;
  setRoundSummary: (summary: RoundSummary) => void;
  clearRoundSummary: () => void;
  setRoundEffects: (effects: RoundEffect[]) => void;
  clearRoundEffects: () => void;
  setScoreHistory: (history: ScoreHistoryEntry[]) => void;
  setError: (error: string | null) => void;
  setGameEnded: (data: {
    winner: 'team1' | 'team2';
    scores: ClientGameState['scores'];
    scoreHistory: ScoreHistoryEntry[];
    teamNames?: { team1: string; team2: string };
  }) => void;
  setGameSummary: (summary: string) => void;
  setTeamNameReveal: (data: {
    players: { nickname: string; team: 'team1' | 'team2' }[];
    teamNames: {
      team1: string;
      team2: string;
      startButton?: string;
    } | null;
  }) => void;
  updateTeamNameReveal: (teamNames: {
    team1: string;
    team2: string;
    startButton?: string;
  }) => void;
  clearTeamNameReveal: () => void;
  setMyPosition: (position: Position) => void;
  revealCards: () => void;
  setAvailableSeats: (roomId: string, seats: AvailableSeat[]) => void;
  clearAvailableSeats: () => void;
  setKickedForIdle: () => void;
  clearRestoringSession: () => void;
  reset: () => void;
}

// Session persistence - use sessionStorage so each tab has its own session.
// Declared above the store because the store's initial `restoringSession` value
// calls loadSession() at creation time.
const SESSION_KEY = 'spades_session';

// The round in which this tab clicked See Cards. Persisted (rather than kept
// only in the store) so it survives a full page reload, which is exactly the
// case where the server may never have received the `game:see-cards` event —
// see the viewedRound comment on 'player:reconnect' in shared/types/events.ts.
// Keyed by room so a stale entry can't follow the player into a different game.
const VIEWED_ROUND_KEY = 'spades_viewed_round';

export function saveSession(roomId: string, sessionToken: string) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ roomId, sessionToken, timestamp: Date.now() })
  );
}

export function loadSession(): { roomId: string; sessionToken: string } | null {
  try {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (!data) return null;

    const session = JSON.parse(data);
    // Session expires after 30 minutes
    if (Date.now() - session.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(VIEWED_ROUND_KEY);
}

export function saveViewedRound(roomId: string, roundNumber: number) {
  try {
    sessionStorage.setItem(
      VIEWED_ROUND_KEY,
      JSON.stringify({ roomId, roundNumber })
    );
  } catch {
    // sessionStorage unavailable or full — the server's own hasViewedCards
    // record is the primary source; this is only the recovery path.
  }
}

export function loadViewedRound(roomId: string): number | null {
  try {
    const data = sessionStorage.getItem(VIEWED_ROUND_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    if (parsed?.roomId !== roomId) return null;
    return typeof parsed.roundNumber === 'number' ? parsed.roundNumber : null;
  } catch {
    return null;
  }
}

/**
 * Leave the current game: drop the saved session and wipe the store. Callers
 * navigate afterwards.
 *
 * Clearing the session is the load-bearing part. sessionStorage survives a
 * reload, so a page that leaves it in place reconnects straight back into the
 * game it just left — since #332 `reconnect:success` restores roomId/position,
 * which lands the player back at the table of an already-finished game instead
 * of the lobby. Before #332 the same code only reached the lobby by accident,
 * because a reconnect couldn't rebuild enough state to render the table.
 */
export function leaveGameSession() {
  clearSession();
  useGameStore.getState().reset();
}

const initialState = {
  roomId: null,
  sessionToken: null,
  myPosition: null,
  nickname: null,
  gameState: null,
  myHand: [],
  lastTrickWinner: null,
  roundSummary: null,
  roundEffects: [],
  scoreHistory: [],
  error: null,
  gameEnded: null,
  gameSummary: null,
  teamNameReveal: null,
  cardsRevealed: false,
  availableSeats: null,
  seatSelectRoomId: null,
  kickedForIdle: false,
  restoringSession: false,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  // Not part of `initialState` on purpose: reset() means "leave the room", and
  // the callers that reset also clearSession(), so there is nothing to restore.
  restoringSession: loadSession() !== null,

  setSession: (roomId, sessionToken, position) =>
    set({ roomId, sessionToken, myPosition: position }),

  setNickname: (nickname) => set({ nickname }),

  setGameState: (state) => set({ gameState: state }),

  setHand: (hand) => set({ myHand: hand, cardsRevealed: false }),

  removeCard: (card) =>
    set((state) => ({
      myHand: state.myHand.filter(
        (c) => !(c.suit === card.suit && c.rank === card.rank)
      ),
    })),

  setTrickWinner: (winnerId) => set({ lastTrickWinner: winnerId }),

  clearTrickWinner: () => set({ lastTrickWinner: null }),

  setRoundSummary: (summary) => set({ roundSummary: summary }),

  clearRoundSummary: () => set({ roundSummary: null }),

  setRoundEffects: (effects) => set({ roundEffects: effects }),

  clearRoundEffects: () => set({ roundEffects: [] }),

  setScoreHistory: (history) => set({ scoreHistory: history }),

  setError: (error) => set({ error }),

  setGameEnded: (data) => set({ gameEnded: data, gameSummary: null }),

  setGameSummary: (summary) => set({ gameSummary: summary }),

  setTeamNameReveal: (data) => set({ teamNameReveal: data }),

  updateTeamNameReveal: (teamNames) =>
    set((state) =>
      state.teamNameReveal
        ? { teamNameReveal: { ...state.teamNameReveal, teamNames } }
        : {}
    ),

  clearTeamNameReveal: () => set({ teamNameReveal: null }),

  setMyPosition: (position) => set({ myPosition: position }),

  revealCards: () => set({ cardsRevealed: true }),

  setAvailableSeats: (roomId, seats) =>
    set({ availableSeats: seats, seatSelectRoomId: roomId }),

  clearAvailableSeats: () =>
    set({ availableSeats: null, seatSelectRoomId: null }),

  setKickedForIdle: () => set({ kickedForIdle: true }),

  clearRestoringSession: () => set({ restoringSession: false }),

  reset: () => set(initialState),
}));

// Debug-relay breadcrumb buffer. Breadcrumbs that occur while the socket is
// disconnected (e.g. 'disconnect', 'reconnect_failed') can't be emitted live,
// so they're buffered here and flushed on the next 'connect'. Bounded so a long
// offline streak can't grow it unbounded.
const DEBUG_BUFFER_KEY = 'spades_debug_buffer';

export interface DebugBreadcrumb {
  event: string;
  reason?: string;
  t: number;
}

export function bufferDebug(entry: DebugBreadcrumb) {
  try {
    const raw = sessionStorage.getItem(DEBUG_BUFFER_KEY);
    const buf: DebugBreadcrumb[] = raw ? JSON.parse(raw) : [];
    buf.push(entry);
    sessionStorage.setItem(DEBUG_BUFFER_KEY, JSON.stringify(buf.slice(-50)));
  } catch {
    // sessionStorage unavailable or full — debug telemetry is best-effort.
  }
}

export function drainDebugBuffer(): DebugBreadcrumb[] {
  try {
    const raw = sessionStorage.getItem(DEBUG_BUFFER_KEY);
    sessionStorage.removeItem(DEBUG_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
