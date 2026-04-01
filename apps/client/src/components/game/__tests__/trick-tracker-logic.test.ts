import type { ClientGameState } from '@spades/shared';
import { describe, expect, it } from 'vitest';
import {
  computeDotStates,
  computeDotZones,
  extractTrickTrackerData,
  type TrickTrackerData,
} from '../trick-tracker-logic';

function makeGameState(
  overrides: Partial<ClientGameState> = {}
): ClientGameState {
  return {
    id: 'test',
    phase: 'bidding',
    players: [
      {
        id: 'p0',
        nickname: 'A',
        position: 0,
        team: 'team1',
        cardCount: 13,
        connected: true,
        ready: true,
      },
      {
        id: 'p1',
        nickname: 'B',
        position: 1,
        team: 'team2',
        cardCount: 13,
        connected: true,
        ready: true,
      },
      {
        id: 'p2',
        nickname: 'C',
        position: 2,
        team: 'team1',
        cardCount: 13,
        connected: true,
        ready: true,
      },
      {
        id: 'p3',
        nickname: 'D',
        position: 3,
        team: 'team2',
        cardCount: 13,
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
      bids: [],
      currentTrick: { plays: [], leadSuit: null },
      tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0 },
      spadesBroken: false,
    },
    dealerPosition: 0,
    currentPlayerPosition: 1,
    turnStartedAt: null,
    winningScore: 500,
    ...overrides,
  };
}

describe('extractTrickTrackerData', () => {
  it('returns null when currentRound is null', () => {
    const gs = makeGameState({ currentRound: null });
    expect(extractTrickTrackerData(gs)).toBeNull();
  });

  it('sums non-nil bids per team', () => {
    const gs = makeGameState({
      currentRound: {
        roundNumber: 1,
        bids: [
          { playerId: 'p0', bid: 4, isNil: false, isBlindNil: false },
          { playerId: 'p1', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 2, isNil: false, isBlindNil: false },
          { playerId: 'p3', bid: 4, isNil: false, isBlindNil: false },
        ],
        currentTrick: { plays: [], leadSuit: null },
        tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0 },
        spadesBroken: false,
      },
    });
    const data = extractTrickTrackerData(gs)!;
    expect(data.team1Bid).toBe(6);
    expect(data.team2Bid).toBe(7);
  });

  it('excludes nil bids from team totals', () => {
    const gs = makeGameState({
      currentRound: {
        roundNumber: 1,
        bids: [
          { playerId: 'p0', bid: 0, isNil: true, isBlindNil: false },
          { playerId: 'p1', bid: 5, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
          { playerId: 'p3', bid: 0, isNil: false, isBlindNil: true },
        ],
        currentTrick: { plays: [], leadSuit: null },
        tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0 },
        spadesBroken: false,
      },
    });
    const data = extractTrickTrackerData(gs)!;
    expect(data.team1Bid).toBe(4); // only p2
    expect(data.team2Bid).toBe(5); // only p1
  });

  it('sums tricksWon per team', () => {
    const gs = makeGameState({
      phase: 'playing',
      currentRound: {
        roundNumber: 1,
        bids: [
          { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p1', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
        ],
        currentTrick: { plays: [], leadSuit: null },
        tricksWon: { p0: 2, p1: 1, p2: 3, p3: 2 },
        spadesBroken: true,
      },
    });
    const data = extractTrickTrackerData(gs)!;
    expect(data.team1Won).toBe(5);
    expect(data.team2Won).toBe(3);
    expect(data.phase).toBe('playing');
  });

  it('maps dealing phase to bidding', () => {
    const gs = makeGameState({ phase: 'dealing' });
    const data = extractTrickTrackerData(gs)!;
    expect(data.phase).toBe('bidding');
  });

  it('maps trick-end to playing', () => {
    const gs = makeGameState({ phase: 'trick-end' });
    const data = extractTrickTrackerData(gs)!;
    expect(data.phase).toBe('playing');
  });

  it('maps round-end to playing', () => {
    const gs = makeGameState({ phase: 'round-end' });
    const data = extractTrickTrackerData(gs)!;
    expect(data.phase).toBe('playing');
  });

  it('handles partial bids during bidding', () => {
    const gs = makeGameState({
      phase: 'bidding',
      currentRound: {
        roundNumber: 1,
        bids: [{ playerId: 'p0', bid: 4, isNil: false, isBlindNil: false }],
        currentTrick: { plays: [], leadSuit: null },
        tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0 },
        spadesBroken: false,
      },
    });
    const data = extractTrickTrackerData(gs)!;
    expect(data.team1Bid).toBe(4);
    expect(data.team2Bid).toBe(0);
  });
});

describe('computeDotZones', () => {
  it('exact bid (total = 13)', () => {
    const zones = computeDotZones(6, 7);
    expect(zones.filter((z) => z === 'team1')).toHaveLength(6);
    expect(zones.filter((z) => z === 'team2')).toHaveLength(7);
    expect(zones.filter((z) => z === 'unclaimed')).toHaveLength(0);
    // team1 fills 0-5, team2 fills 6-12
    expect(zones[5]).toBe('team1');
    expect(zones[6]).toBe('team2');
  });

  it('underbid (total < 13)', () => {
    const zones = computeDotZones(4, 5);
    expect(zones.filter((z) => z === 'team1')).toHaveLength(4);
    expect(zones.filter((z) => z === 'team2')).toHaveLength(5);
    expect(zones.filter((z) => z === 'unclaimed')).toHaveLength(4);
    // team1: 0-3, unclaimed: 4-7, team2: 8-12
    expect(zones[3]).toBe('team1');
    expect(zones[4]).toBe('unclaimed');
    expect(zones[7]).toBe('unclaimed');
    expect(zones[8]).toBe('team2');
  });

  it('overbid (total > 13)', () => {
    const zones = computeDotZones(8, 8);
    // overlap = 3 contested dots
    // team1 exclusive: 0..4 (13-8=5 start of team2 claims)
    // contested: 5..7 (team1Bid=8 end)
    // team2 exclusive: 8..12
    expect(zones.filter((z) => z === 'team1')).toHaveLength(5);
    expect(zones.filter((z) => z === 'contested')).toHaveLength(3);
    expect(zones.filter((z) => z === 'team2')).toHaveLength(5);
    expect(zones[4]).toBe('team1');
    expect(zones[5]).toBe('contested');
    expect(zones[7]).toBe('contested');
    expect(zones[8]).toBe('team2');
  });

  it('both bids 0 (both nil)', () => {
    const zones = computeDotZones(0, 0);
    expect(zones.every((z) => z === 'unclaimed')).toBe(true);
  });

  it('one side 0', () => {
    const zones = computeDotZones(7, 0);
    expect(zones.filter((z) => z === 'team1')).toHaveLength(7);
    expect(zones.filter((z) => z === 'unclaimed')).toHaveLength(6);
    expect(zones.filter((z) => z === 'team2')).toHaveLength(0);
  });

  it('other side 0', () => {
    const zones = computeDotZones(0, 5);
    expect(zones.filter((z) => z === 'team1')).toHaveLength(0);
    expect(zones.filter((z) => z === 'unclaimed')).toHaveLength(8);
    expect(zones.filter((z) => z === 'team2')).toHaveLength(5);
    expect(zones[8]).toBe('team2');
  });

  it('team1=13, team2=0', () => {
    const zones = computeDotZones(13, 0);
    expect(zones.every((z) => z === 'team1')).toBe(true);
  });
});

describe('computeDotStates', () => {
  it('bidding phase with no tricks shows all unclaimed', () => {
    const data: TrickTrackerData = {
      team1Bid: 5,
      team2Bid: 4,
      team1Won: 0,
      team2Won: 0,
      phase: 'bidding',
    };
    const states = computeDotStates(data);
    for (const state of states) {
      expect(state).toEqual({ type: 'unclaimed' });
    }
  });

  it('won within bid shows won state', () => {
    const data: TrickTrackerData = {
      team1Bid: 5,
      team2Bid: 5,
      team1Won: 3,
      team2Won: 2,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // team1 won 0-2
    for (let i = 0; i < 3; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team1' });
    }
    // remaining 3-10: unclaimed (bids shown via background zones, not dots)
    for (let i = 3; i <= 10; i++) {
      expect(states[i]).toEqual({ type: 'unclaimed' });
    }
    // team2 won 11-12
    expect(states[11]).toEqual({ type: 'won', team: 'team2' });
    expect(states[12]).toEqual({ type: 'won', team: 'team2' });
  });

  it('bags: won beyond bid into unclaimed zone', () => {
    const data: TrickTrackerData = {
      team1Bid: 3,
      team2Bid: 3,
      team1Won: 5,
      team2Won: 4,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // team1 won 0-4: first 3 are 'won' (in team1 zone), then 2 are 'bag' (unclaimed zone)
    expect(states[0]).toEqual({ type: 'won', team: 'team1' });
    expect(states[1]).toEqual({ type: 'won', team: 'team1' });
    expect(states[2]).toEqual({ type: 'won', team: 'team1' });
    expect(states[3]).toEqual({ type: 'bag', team: 'team1' });
    expect(states[4]).toEqual({ type: 'bag', team: 'team1' });

    // team2 won 9-12: first 1 is 'bag' (unclaimed zone), then 3 are 'won' (team2 zone)
    expect(states[9]).toEqual({ type: 'bag', team: 'team2' });
    expect(states[10]).toEqual({ type: 'won', team: 'team2' });
    expect(states[11]).toEqual({ type: 'won', team: 'team2' });
    expect(states[12]).toEqual({ type: 'won', team: 'team2' });
  });

  it('won beyond bid into opponent zone shows bag', () => {
    const data: TrickTrackerData = {
      team1Bid: 6,
      team2Bid: 7,
      team1Won: 8,
      team2Won: 5,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // team1 won 0-7: 0-5 within bid → 'won', 6-7 beyond bid → 'bag'
    for (let i = 0; i < 6; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team1' });
    }
    expect(states[6]).toEqual({ type: 'bag', team: 'team1' });
    expect(states[7]).toEqual({ type: 'bag', team: 'team1' });

    // team2 won 8-12: all within bid → 'won'
    for (let i = 8; i <= 12; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team2' });
    }
  });

  it('both teams with bags: bid 5 each, win 7 and 6', () => {
    const data: TrickTrackerData = {
      team1Bid: 5,
      team2Bid: 5,
      team1Won: 7,
      team2Won: 6,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // zones: team1=0-4, unclaimed=5-7, team2=8-12
    // team1 won 0-6: 0-4 'won', 5-6 'bag'
    for (let i = 0; i < 5; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team1' });
    }
    expect(states[5]).toEqual({ type: 'bag', team: 'team1' });
    expect(states[6]).toEqual({ type: 'bag', team: 'team1' });

    // team2 won 7-12: 7 is 'bag' (unclaimed), 8-12 are 'won' (team2 zone)
    expect(states[7]).toEqual({ type: 'bag', team: 'team2' });
    for (let i = 8; i <= 12; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team2' });
    }
  });

  it('full round: 13 tricks all completed', () => {
    const data: TrickTrackerData = {
      team1Bid: 7,
      team2Bid: 6,
      team1Won: 7,
      team2Won: 6,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // All 13 should be 'won'
    for (let i = 0; i < 7; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team1' });
    }
    for (let i = 7; i < 13; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team2' });
    }
  });

  it('overbid with no tricks yet shows all unclaimed', () => {
    const data: TrickTrackerData = {
      team1Bid: 8,
      team2Bid: 8,
      team1Won: 0,
      team2Won: 0,
      phase: 'bidding',
    };
    const states = computeDotStates(data);
    for (const state of states) {
      expect(state).toEqual({ type: 'unclaimed' });
    }
  });

  it('overbid with tricks won within bid shows won', () => {
    const data: TrickTrackerData = {
      team1Bid: 8,
      team2Bid: 8,
      team1Won: 7,
      team2Won: 6,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // team1 won 0-6: all within bid of 8 → 'won'
    for (let i = 0; i < 7; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team1' });
    }
    // team2 won 7-12: all within bid of 8 → 'won'
    for (let i = 7; i <= 12; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team2' });
    }
  });

  it('won far beyond bid shows bags regardless of zone', () => {
    const data: TrickTrackerData = {
      team1Bid: 3,
      team2Bid: 4,
      team1Won: 10,
      team2Won: 3,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    // team1 won 0-9: 0-2 within bid → 'won', 3-9 beyond bid → 'bag'
    for (let i = 0; i < 3; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team1' });
    }
    for (let i = 3; i <= 9; i++) {
      expect(states[i]).toEqual({ type: 'bag', team: 'team1' });
    }

    // team2 won 10-12: all within bid → 'won'
    for (let i = 10; i <= 12; i++) {
      expect(states[i]).toEqual({ type: 'won', team: 'team2' });
    }
  });

  it('all unclaimed when both bids are 0', () => {
    const data: TrickTrackerData = {
      team1Bid: 0,
      team2Bid: 0,
      team1Won: 0,
      team2Won: 0,
      phase: 'bidding',
    };
    const states = computeDotStates(data);
    for (const state of states) {
      expect(state).toEqual({ type: 'unclaimed' });
    }
  });

  it('all bags when both bids 0 and tricks won', () => {
    const data: TrickTrackerData = {
      team1Bid: 0,
      team2Bid: 0,
      team1Won: 6,
      team2Won: 7,
      phase: 'playing',
    };
    const states = computeDotStates(data);
    for (let i = 0; i < 6; i++) {
      expect(states[i]).toEqual({ type: 'bag', team: 'team1' });
    }
    for (let i = 6; i < 13; i++) {
      expect(states[i]).toEqual({ type: 'bag', team: 'team2' });
    }
  });
});
