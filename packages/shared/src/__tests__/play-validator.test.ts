import { describe, it, expect } from 'vitest';
import { validatePlay, getPlayableCards } from '../validation/play-validator';
import type { PlayValidationGameState } from '../validation/play-validator';
import type { Card } from '../types/card';

function makeGameState(overrides: Partial<PlayValidationGameState> = {}): PlayValidationGameState {
  return {
    phase: 'playing',
    players: [
      { id: 'p1', position: 0 },
      { id: 'p2', position: 1 },
      { id: 'p3', position: 2 },
      { id: 'p4', position: 3 },
    ],
    currentPlayerPosition: 0,
    currentRound: {
      currentTrick: { plays: [], leadSuit: null },
      spadesBroken: false,
    },
    ...overrides,
  };
}

const heartA: Card = { suit: 'hearts', rank: 'A' };
const heartK: Card = { suit: 'hearts', rank: 'K' };
const heart5: Card = { suit: 'hearts', rank: '5' };
const spadeA: Card = { suit: 'spades', rank: 'A' };
const spadeK: Card = { suit: 'spades', rank: 'K' };
const spade5: Card = { suit: 'spades', rank: '5' };
const clubA: Card = { suit: 'clubs', rank: 'A' };
const club5: Card = { suit: 'clubs', rank: '5' };
const diamondA: Card = { suit: 'diamonds', rank: 'A' };

describe('validatePlay', () => {
  it('rejects when not in playing phase', () => {
    const state = makeGameState({ phase: 'bidding' });
    const result = validatePlay(state, 'p1', heartA, [heartA]);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toMatch(/playing phase/i);
  });

  it('rejects when not player turn', () => {
    const state = makeGameState({ currentPlayerPosition: 1 });
    const result = validatePlay(state, 'p1', heartA, [heartA]);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toMatch(/not your turn/i);
  });

  it('rejects when card not in hand', () => {
    const state = makeGameState();
    const result = validatePlay(state, 'p1', heartA, [heartK]);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toMatch(/not in hand/i);
  });

  it('allows valid non-spade lead', () => {
    const state = makeGameState();
    const result = validatePlay(state, 'p1', heartA, [heartA, spadeA]);
    expect(result.valid).toBe(true);
  });

  it('rejects spade lead when not broken and player has non-spades', () => {
    const state = makeGameState();
    const result = validatePlay(state, 'p1', spadeA, [spadeA, heartA]);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toMatch(/spades/i);
  });

  it('allows spade lead when broken', () => {
    const state = makeGameState({
      currentRound: {
        currentTrick: { plays: [], leadSuit: null },
        spadesBroken: true,
      },
    });
    const result = validatePlay(state, 'p1', spadeA, [spadeA, heartA]);
    expect(result.valid).toBe(true);
  });

  it('allows spade lead when player only has spades', () => {
    const state = makeGameState();
    const result = validatePlay(state, 'p1', spadeA, [spadeA, spadeK]);
    expect(result.valid).toBe(true);
  });

  it('requires following lead suit', () => {
    const state = makeGameState({
      currentRound: {
        currentTrick: {
          plays: [{ playerId: 'p1', card: heartA }],
          leadSuit: 'hearts',
        },
        spadesBroken: false,
      },
      currentPlayerPosition: 1,
    });
    const result = validatePlay(state, 'p2', clubA, [clubA, heartK]);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toMatch(/follow suit/i);
  });

  it('allows any card when player lacks lead suit', () => {
    const state = makeGameState({
      currentRound: {
        currentTrick: {
          plays: [{ playerId: 'p1', card: heartA }],
          leadSuit: 'hearts',
        },
        spadesBroken: false,
      },
      currentPlayerPosition: 1,
    });
    const result = validatePlay(state, 'p2', spadeA, [spadeA, clubA]);
    expect(result.valid).toBe(true);
  });
});

describe('getPlayableCards', () => {
  it('returns only non-spade cards when leading with spades unbroken', () => {
    const state = makeGameState();
    const hand = [spadeA, spadeK, heartA, clubA, diamondA];
    const playable = getPlayableCards(state, 'p1', hand);
    expect(playable).toEqual([heartA, clubA, diamondA]);
  });

  it('returns only lead-suit cards when following and player has that suit', () => {
    const state = makeGameState({
      currentRound: {
        currentTrick: {
          plays: [{ playerId: 'p1', card: heartA }],
          leadSuit: 'hearts',
        },
        spadesBroken: false,
      },
      currentPlayerPosition: 1,
    });
    const hand = [heart5, heartK, clubA, spade5];
    const playable = getPlayableCards(state, 'p2', hand);
    expect(playable).toEqual([heart5, heartK]);
  });

  it('returns all cards when player lacks lead suit', () => {
    const state = makeGameState({
      currentRound: {
        currentTrick: {
          plays: [{ playerId: 'p1', card: heartA }],
          leadSuit: 'hearts',
        },
        spadesBroken: false,
      },
      currentPlayerPosition: 1,
    });
    const hand = [clubA, club5, spadeA, diamondA];
    const playable = getPlayableCards(state, 'p2', hand);
    expect(playable).toEqual([clubA, club5, spadeA, diamondA]);
  });

  it('returns all spades when leading with only spades in hand', () => {
    const state = makeGameState();
    const hand = [spadeA, spadeK, spade5];
    const playable = getPlayableCards(state, 'p1', hand);
    expect(playable).toEqual([spadeA, spadeK, spade5]);
  });
});
