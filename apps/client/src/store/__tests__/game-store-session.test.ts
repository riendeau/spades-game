import type { ClientGameState } from '@spades/shared';
import { beforeEach, describe, expect, it } from 'vitest';

// The client tests run in vitest's default node environment, which has no Web
// Storage. Install a minimal in-memory sessionStorage *before* importing the
// store: the module calls loadSession() at creation time to seed
// `restoringSession`.
class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: storage });

const {
  useGameStore,
  saveSession,
  loadSession,
  leaveGameSession,
  saveViewedRound,
  loadViewedRound,
} = await import('../game-store');

beforeEach(() => {
  storage.clear();
  useGameStore.getState().reset();
});

// Regression test for the "Play Again" bug: the end-of-game button reset the
// store and reloaded the page but left the saved session in sessionStorage,
// which survives the reload. The fresh page then reconnected straight back
// into the finished game — since #332 reconnect:success restores
// roomId/position, so App.tsx rendered the game table instead of the lobby.
describe('leaveGameSession', () => {
  it('clears the saved session so the next page load lands in the lobby', () => {
    saveSession('ABC123', 'token-abc');
    useGameStore.getState().setSession('ABC123', 'token-abc', 2);
    expect(loadSession()).not.toBeNull();

    leaveGameSession();

    expect(loadSession()).toBeNull();
    expect(useGameStore.getState().roomId).toBeNull();
    expect(useGameStore.getState().myPosition).toBeNull();
  });

  it('clears the persisted See Cards decision too', () => {
    saveSession('ABC123', 'token-abc');
    saveViewedRound('ABC123', 3);

    leaveGameSession();

    expect(loadViewedRound('ABC123')).toBeNull();
  });
});

// The round the seat clicked See Cards in, re-asserted on player:reconnect to
// recover a `game:see-cards` event the server never received.
describe('viewed round persistence', () => {
  it('round-trips the round number for the room it was saved for', () => {
    saveViewedRound('ABC123', 4);
    expect(loadViewedRound('ABC123')).toBe(4);
  });

  it('does not leak into a different room', () => {
    saveViewedRound('ABC123', 4);
    expect(loadViewedRound('XYZ789')).toBeNull();
  });

  it('returns null when nothing was saved', () => {
    expect(loadViewedRound('ABC123')).toBeNull();
  });

  it('returns null on a malformed entry rather than throwing', () => {
    storage.setItem('spades_viewed_round', 'not json');
    expect(loadViewedRound('ABC123')).toBeNull();
  });
});

// The See Cards decision has three side effects (reveal, notify the server,
// persist for reconnect recovery). Persistence lives in the store action rather
// than only in use-game's wrapper so that any reveal path commits it — a
// store-level caller that skipped it would silently recreate the bug this
// suite's sibling server tests cover.
describe('revealCards', () => {
  it('persists the round it revealed in', () => {
    const store = useGameStore.getState();
    store.setSession('ABC123', 'token-abc', 0);
    store.setGameState({
      currentRound: { roundNumber: 5 },
    } as unknown as ClientGameState);

    useGameStore.getState().revealCards();

    expect(useGameStore.getState().cardsRevealed).toBe(true);
    expect(loadViewedRound('ABC123')).toBe(5);
  });

  it('is a no-op for persistence before a round exists', () => {
    const store = useGameStore.getState();
    store.setSession('ABC123', 'token-abc', 0);

    useGameStore.getState().revealCards();

    expect(useGameStore.getState().cardsRevealed).toBe(true);
    expect(loadViewedRound('ABC123')).toBeNull();
  });
});
