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
  roundEffects: [],
  scoreHistory: [],
  error: null,
  gameEnded: null,
  gameSummary: null,
  teamNameReveal: null,
  cardsRevealed: false,
  availableSeats: null,
  seatSelectRoomId: null,
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

  reset: () => set(initialState),
}));

// Session persistence - use sessionStorage so each tab has its own session
const SESSION_KEY = 'spades_session';

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
}
