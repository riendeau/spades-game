import { create } from 'zustand';
import type { Card, ClientGameState, Position, RoundSummary } from '@spades/shared';

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
  error: string | null;
  gameEnded: { winner: 'team1' | 'team2'; scores: ClientGameState['scores'] } | null;
  cardsRevealed: boolean;

  // Actions
  setSession: (roomId: string, sessionToken: string, position: Position) => void;
  setNickname: (nickname: string) => void;
  setGameState: (state: ClientGameState) => void;
  setHand: (hand: Card[]) => void;
  removeCard: (card: Card) => void;
  setTrickWinner: (winnerId: string) => void;
  clearTrickWinner: () => void;
  setRoundSummary: (summary: RoundSummary) => void;
  clearRoundSummary: () => void;
  setError: (error: string | null) => void;
  setGameEnded: (data: { winner: 'team1' | 'team2'; scores: ClientGameState['scores'] }) => void;
  revealCards: () => void;
  reset: () => void;
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
  error: null,
  gameEnded: null,
  cardsRevealed: false
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setSession: (roomId, sessionToken, position) =>
    set({ roomId, sessionToken, myPosition: position }),

  setNickname: (nickname) => set({ nickname }),

  setGameState: (state) => set({ gameState: state }),

  setHand: (hand) => set({ myHand: hand, cardsRevealed: false }),

  removeCard: (card) =>
    set((state) => ({
      myHand: state.myHand.filter(
        (c) => !(c.suit === card.suit && c.rank === card.rank)
      )
    })),

  setTrickWinner: (winnerId) => set({ lastTrickWinner: winnerId }),

  clearTrickWinner: () => set({ lastTrickWinner: null }),

  setRoundSummary: (summary) => set({ roundSummary: summary }),

  clearRoundSummary: () => set({ roundSummary: null }),

  setError: (error) => set({ error }),

  setGameEnded: (data) => set({ gameEnded: data }),

  revealCards: () => set({ cardsRevealed: true }),

  reset: () => set(initialState)
}));

// Session persistence - use sessionStorage so each tab has its own session
const SESSION_KEY = 'spades_session';

export function saveSession(roomId: string, sessionToken: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, sessionToken, timestamp: Date.now() }));
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
}
