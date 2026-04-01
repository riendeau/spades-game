import type { Card, ClientGameState } from '@spades/shared';
import { describe, it, expect } from 'vitest';
import { detectSluff } from '../sluff-detection';

function makeCard(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

function makeGameState(
  overrides: {
    bids?: ClientGameState['currentRound'] extends infer R
      ? R extends { bids: infer B }
        ? B
        : never
      : never;
    tricksWon?: Record<string, number>;
    leadSuit?: Card['suit'] | null;
  } = {}
): ClientGameState {
  return {
    id: 'game-1',
    phase: 'playing',
    players: [
      {
        id: 'p0',
        nickname: 'Alice',
        position: 0 as const,
        team: 'team1',
        cardCount: 10,
        connected: true,
        ready: true,
      },
      {
        id: 'p1',
        nickname: 'Bob',
        position: 1 as const,
        team: 'team2',
        cardCount: 10,
        connected: true,
        ready: true,
      },
      {
        id: 'p2',
        nickname: 'Carol',
        position: 2 as const,
        team: 'team1',
        cardCount: 10,
        connected: true,
        ready: true,
      },
      {
        id: 'p3',
        nickname: 'Dave',
        position: 3 as const,
        team: 'team2',
        cardCount: 10,
        connected: true,
        ready: true,
      },
    ],
    scores: {
      team1: {
        teamId: 'team1',
        score: 0,
        bags: 0,
        roundBid: 0,
        roundTricks: 0,
      },
      team2: {
        teamId: 'team2',
        score: 0,
        bags: 0,
        roundBid: 0,
        roundTricks: 0,
      },
    },
    currentRound: {
      roundNumber: 1,
      bids: overrides.bids ?? [
        { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
        { playerId: 'p1', bid: 0, isNil: true, isBlindNil: false },
        { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
        { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
      ],
      currentTrick: {
        plays: [],
        leadSuit: overrides.leadSuit ?? 'hearts',
      },
      tricksWon: overrides.tricksWon ?? {},
      spadesBroken: false,
    },
    dealerPosition: 3 as const,
    currentPlayerPosition: 0 as const,
    turnStartedAt: null,
    winningScore: 500,
  };
}

describe('detectSluff', () => {
  it('returns null when player did not bid nil', () => {
    const state = makeGameState({
      bids: [
        { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
        { playerId: 'p1', bid: 2, isNil: false, isBlindNil: false },
        { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
        { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
      ],
    });
    const plays = [
      { playerId: 'p0', card: makeCard('3', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    expect(detectSluff(plays, 1, state)).toBeNull();
  });

  it('returns null when player has already won a trick', () => {
    const state = makeGameState({
      tricksWon: { p1: 1 },
    });
    const plays = [
      { playerId: 'p0', card: makeCard('4', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    expect(detectSluff(plays, 1, state)).toBeNull();
  });

  it('returns null when player is leading (first play)', () => {
    const state = makeGameState();
    const plays = [{ playerId: 'p1', card: makeCard('2', 'hearts') }];
    expect(detectSluff(plays, 0, state)).toBeNull();
  });

  it('returns null when spades played on trick (non-spades lead)', () => {
    const state = makeGameState();
    const plays = [
      { playerId: 'p0', card: makeCard('3', 'hearts') },
      { playerId: 'p3', card: makeCard('2', 'spades') }, // spade played
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    expect(detectSluff(plays, 2, state)).toBeNull();
  });

  it('returns null when highest lead-suit card is above 5', () => {
    const state = makeGameState();
    const plays = [
      { playerId: 'p0', card: makeCard('6', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    expect(detectSluff(plays, 1, state)).toBeNull();
  });

  it('returns null when player does not follow suit', () => {
    const state = makeGameState();
    const plays = [
      { playerId: 'p0', card: makeCard('3', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'diamonds') },
    ];
    expect(detectSluff(plays, 1, state)).toBeNull();
  });

  it('returns null when played card is higher than all lead-suit cards on table', () => {
    const state = makeGameState();
    const plays = [
      { playerId: 'p0', card: makeCard('3', 'hearts') },
      { playerId: 'p1', card: makeCard('5', 'hearts') },
    ];
    expect(detectSluff(plays, 1, state)).toBeNull();
  });

  it('returns SluffInfo when all conditions met (non-spades lead)', () => {
    const state = makeGameState();
    const plays = [
      { playerId: 'p0', card: makeCard('4', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    const result = detectSluff(plays, 1, state);
    expect(result).toEqual({ targetPlayerId: 'p0' });
  });

  it('returns SluffInfo when lead suit is spades', () => {
    const state = makeGameState({
      bids: [
        { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
        { playerId: 'p1', bid: 0, isNil: true, isBlindNil: false },
        { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
        { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
      ],
      leadSuit: 'spades',
    });
    const plays = [
      { playerId: 'p0', card: makeCard('5', 'spades') },
      { playerId: 'p1', card: makeCard('3', 'spades') },
    ];
    const result = detectSluff(plays, 1, state);
    expect(result).toEqual({ targetPlayerId: 'p0' });
  });

  it('returns SluffInfo for blind nil', () => {
    const state = makeGameState({
      bids: [
        { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
        { playerId: 'p1', bid: 0, isNil: false, isBlindNil: true },
        { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
        { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
      ],
    });
    const plays = [
      { playerId: 'p0', card: makeCard('4', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    const result = detectSluff(plays, 1, state);
    expect(result).toEqual({ targetPlayerId: 'p0' });
  });

  it('correctly identifies the next-highest target (not just any higher card)', () => {
    const state = makeGameState();
    // p0 plays 5H, p2 plays 3H, then nil p1 plays 2H
    // The next-higher card above 2 is 3 (p2), not 5 (p0)
    const plays = [
      { playerId: 'p0', card: makeCard('5', 'hearts') },
      { playerId: 'p2', card: makeCard('3', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    const result = detectSluff(plays, 2, state);
    expect(result).toEqual({ targetPlayerId: 'p2' });
  });

  it('returns null when currentRound is null', () => {
    const state = makeGameState();
    state.currentRound = null;
    const plays = [
      { playerId: 'p0', card: makeCard('3', 'hearts') },
      { playerId: 'p1', card: makeCard('2', 'hearts') },
    ];
    expect(detectSluff(plays, 1, state)).toBeNull();
  });

  it('returns null when newPlayIndex is out of bounds', () => {
    const state = makeGameState();
    const plays = [{ playerId: 'p0', card: makeCard('3', 'hearts') }];
    expect(detectSluff(plays, 5, state)).toBeNull();
  });
});
