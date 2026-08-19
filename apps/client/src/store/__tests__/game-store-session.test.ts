import type { ClientGameState } from '@spades/shared';
import { beforeEach, describe, expect, it } from 'vitest';

// The client tests run in vitest's default node environment, which has no Web
// Storage. Install a minimal in-memory sessionStorage *before* importing the
// store: the module calls loadSession() at creation time to seed
// `restoringSession`.
class MemoryStorage {
  private data = new Map<string, string>();

  /** Simulate a full store / private-mode Safari, which throws on write. */
  failWrites = false;

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
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
  loadViewedRound,
} = await import('../game-store');

beforeEach(() => {
  storage.clear();
  storage.failWrites = false;
  useGameStore.getState().reset();
});

/** Seat into `roomId` mid-round and commit the See Cards decision. */
function revealInRound(roomId: string, roundNumber: number) {
  const store = useGameStore.getState();
  store.setSession(roomId, 'token-abc', 0);
  store.setGameState({
    currentRound: { roundNumber },
  } as unknown as ClientGameState);
  useGameStore.getState().revealCards();
}

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
    revealInRound('ABC123', 3);

    leaveGameSession();

    expect(loadViewedRound('ABC123')).toBeNull();
  });
});

// Every persisted value goes through the shared read/write policy in
// session-storage.ts, so a corrupt entry reads back as null and an unwritable
// store is a silent no-op. Before #352 each block rolled its own: saveSession
// threw on a full store while saveViewedRound swallowed it, and loadSession
// returned whatever JSON.parse produced while loadViewedRound shape-checked it.
describe('session persistence is failure-tolerant', () => {
  it('returns null for a session entry with the wrong shape', () => {
    storage.setItem('spades_session', JSON.stringify({ roomId: 'ABC123' }));
    expect(loadSession()).toBeNull();
  });

  it('returns null for a malformed session entry rather than throwing', () => {
    storage.setItem('spades_session', 'not json');
    expect(loadSession()).toBeNull();
  });

  it('expires a session older than 30 minutes', () => {
    storage.setItem(
      'spades_session',
      JSON.stringify({
        roomId: 'ABC123',
        sessionToken: 'token-abc',
        timestamp: Date.now() - 31 * 60 * 1000,
      })
    );
    expect(loadSession()).toBeNull();
  });

  it('does not throw when the store rejects the write', () => {
    storage.failWrites = true;
    expect(() => {
      saveSession('ABC123', 'token-abc');
    }).not.toThrow();
    expect(loadSession()).toBeNull();
  });
});

// The round the seat clicked See Cards in, re-asserted on player:reconnect to
// recover a `game:see-cards` event the server never received. Written only by
// the store's `revealCards` action, so these drive it the same way the app does.
describe('viewed round persistence', () => {
  it('round-trips the round number for the room it was saved for', () => {
    revealInRound('ABC123', 4);
    expect(loadViewedRound('ABC123')).toBe(4);
  });

  it('does not leak into a different room', () => {
    revealInRound('ABC123', 4);
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
    revealInRound('ABC123', 5);

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
