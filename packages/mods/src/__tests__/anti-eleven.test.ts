import type {
  CalculateDisabledBidsContext,
  PlayerBid,
  RoundEndContext,
  RoundSummary,
} from '@spades/shared';
import { createInitialGameState, DEFAULT_GAME_CONFIG } from '@spades/shared';
import { describe, it, expect, vi } from 'vitest';
import { antiElevenMod } from '../rules/anti-eleven.js';

const onCalculateDisabledBids = antiElevenMod.hooks.onCalculateDisabledBids!;
const onRoundEnd = antiElevenMod.hooks.onRoundEnd!;

function makeBid(
  bid: number,
  opts?: { isNil?: boolean; isBlindNil?: boolean }
): PlayerBid {
  return {
    playerId: `p${bid}`,
    bid,
    isNil: opts?.isNil ?? false,
    isBlindNil: opts?.isBlindNil ?? false,
  };
}

function makeBidContext(
  currentBids: PlayerBid[],
  modState?: unknown
): CalculateDisabledBidsContext {
  return {
    gameState: createInitialGameState('test'),
    config: DEFAULT_GAME_CONFIG,
    playerId: 'p4',
    currentBids,
    modState: modState ?? undefined,
    disabledBids: [],
  };
}

function makeRoundSummary(overrides?: {
  team1Bid?: number;
  team2Bid?: number;
  team1NilResults?: RoundSummary['team1']['nilResults'];
  team2NilResults?: RoundSummary['team2']['nilResults'];
}): RoundSummary {
  return {
    roundNumber: 1,
    team1: {
      bid: overrides?.team1Bid ?? 4,
      tricks: 4,
      points: 40,
      bags: 0,
      bagPenalty: 0,
      nilResults: overrides?.team1NilResults ?? [],
    },
    team2: {
      bid: overrides?.team2Bid ?? 4,
      tricks: 4,
      points: 40,
      bags: 0,
      bagPenalty: 0,
      nilResults: overrides?.team2NilResults ?? [],
    },
  };
}

function makeRoundEndContext(
  roundSummary: RoundSummary,
  modState?: unknown
): RoundEndContext {
  return {
    gameState: createInitialGameState('test'),
    config: DEFAULT_GAME_CONFIG,
    roundSummary,
    modState: modState ?? undefined,
  };
}

describe('antiElevenMod', () => {
  describe('onCalculateDisabledBids', () => {
    it('does nothing when fewer than 3 bids placed', () => {
      const ctx = makeBidContext([makeBid(3), makeBid(4)]);
      const result = onCalculateDisabledBids(ctx);
      expect(result.disabledBids).toEqual([]);
    });

    it('does nothing when table bid already >= 11', () => {
      const ctx = makeBidContext([makeBid(4), makeBid(4), makeBid(4)], {
        disablementChance: 1.0,
      });
      const result = onCalculateDisabledBids(ctx);
      expect(result.disabledBids).toEqual([]);
    });

    it('skips disablement when a nil bid is on the table', () => {
      const ctx = makeBidContext(
        [makeBid(4), makeBid(0, { isNil: true }), makeBid(3)],
        { disablementChance: 1.0 } // 100% chance — would always fire
      );
      const result = onCalculateDisabledBids(ctx);
      expect(result.disabledBids).toEqual([]);
    });

    it('skips disablement when a blind nil bid is on the table', () => {
      const ctx = makeBidContext(
        [makeBid(5), makeBid(0, { isBlindNil: true }), makeBid(2)],
        { disablementChance: 1.0 }
      );
      const result = onCalculateDisabledBids(ctx);
      expect(result.disabledBids).toEqual([]);
    });

    it('disables the bid that would make total 11 when chance is 100%', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // below any positive chance
      const ctx = makeBidContext([makeBid(3), makeBid(4), makeBid(1)], {
        disablementChance: 1.0,
      });
      // table = 3+4+1 = 8, target = 11-8 = 3
      const result = onCalculateDisabledBids(ctx);
      expect(result.disabledBids).toContain(3);
      vi.restoreAllMocks();
    });

    it('does not disable when chance is 0%', () => {
      const ctx = makeBidContext([makeBid(3), makeBid(4), makeBid(1)], {
        disablementChance: 0,
      });
      const result = onCalculateDisabledBids(ctx);
      expect(result.disabledBids).toEqual([]);
    });
  });

  describe('onRoundEnd', () => {
    it('increases chance by 10% when total bid is 11 with no nil bids', () => {
      const summary = makeRoundSummary({ team1Bid: 5, team2Bid: 6 });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0,
          disablementOccurredThisRound: false,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0.1);
    });

    it('does not increase chance when total bid is not 11', () => {
      const summary = makeRoundSummary({ team1Bid: 5, team2Bid: 5 });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.2,
          disablementOccurredThisRound: false,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0.2);
    });

    it('does not increase chance when total bid is 11 but team1 has a nil bid', () => {
      const summary = makeRoundSummary({
        team1Bid: 5,
        team2Bid: 6,
        team1NilResults: [
          { playerId: 'p1', isBlindNil: false, succeeded: true },
        ],
      });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.3,
          disablementOccurredThisRound: false,
        })
      );
      // Chance should stay at 0.3, not increase to 0.4
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0.3);
    });

    it('does not increase chance when total bid is 11 but team2 has a blind nil bid', () => {
      const summary = makeRoundSummary({
        team1Bid: 4,
        team2Bid: 7,
        team2NilResults: [
          { playerId: 'p2', isBlindNil: true, succeeded: false },
        ],
      });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.5,
          disablementOccurredThisRound: false,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0.5);
    });

    it('resets chance to 0% after disablement occurred on an 11-round', () => {
      const summary = makeRoundSummary({ team1Bid: 5, team2Bid: 6 });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.8,
          disablementOccurredThisRound: true,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0);
    });

    it('caps chance at 100%', () => {
      const summary = makeRoundSummary({ team1Bid: 5, team2Bid: 6 });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.95,
          disablementOccurredThisRound: false,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(1.0);
    });
  });
});
