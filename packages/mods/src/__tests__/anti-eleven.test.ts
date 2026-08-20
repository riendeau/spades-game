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

    it('resets chance to 0% when disablement fires', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // below any positive chance
      const ctx = makeBidContext([makeBid(3), makeBid(4), makeBid(1)], {
        disablementChance: 0.8,
      });
      const result = onCalculateDisabledBids(ctx);
      vi.restoreAllMocks();

      expect(result.disabledBids).toContain(3);
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0);
    });

    it('leaves chance untouched when disablement does not fire', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // above the 0.5 chance
      const ctx = makeBidContext([makeBid(3), makeBid(4), makeBid(1)], {
        disablementChance: 0.5,
      });
      const result = onCalculateDisabledBids(ctx);
      vi.restoreAllMocks();

      expect(result.disabledBids).toEqual([]);
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0.5);
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
          { playerId: 'p1', isBlindNil: false, succeeded: true, points: 100 },
        ],
      });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.3,
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
          { playerId: 'p2', isBlindNil: true, succeeded: false, points: -200 },
        ],
      });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.5,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(0.5);
    });

    it('caps chance at 100%', () => {
      const summary = makeRoundSummary({ team1Bid: 5, team2Bid: 6 });
      const result = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0.95,
        })
      );
      expect(
        (result.modState as { disablementChance: number }).disablementChance
      ).toBe(1.0);
    });
  });

  // Regression: the reset used to live in onRoundEnd behind a `totalBid === 11`
  // check, which a round the mod fired on can never satisfy — so the chance was
  // never actually reset and could fire again the very next round.
  describe('firing then round end', () => {
    it('spends the chance on firing and does not restore it at round end', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      // Chance has built up to 80% over several natural-11 rounds.
      const bidResult = onCalculateDisabledBids(
        makeBidContext([makeBid(3), makeBid(4), makeBid(1)], {
          disablementChance: 0.8,
        })
      );
      vi.restoreAllMocks();
      expect(bidResult.disabledBids).toContain(3);

      // The 4th player is forced off 3 and bids 4 instead, so the table
      // totals 12 — this round can't be a natural 11 by construction.
      const summary = makeRoundSummary({ team1Bid: 4, team2Bid: 8 });
      const roundResult = onRoundEnd(
        makeRoundEndContext(summary, bidResult.modState)
      );

      expect(
        (roundResult.modState as { disablementChance: number })
          .disablementChance
      ).toBe(0);
    });

    it('re-rolls from the reset chance on the following round', () => {
      const summary = makeRoundSummary({ team1Bid: 4, team2Bid: 8 });
      const afterRound = onRoundEnd(
        makeRoundEndContext(summary, {
          disablementChance: 0,
          shouldDisableThisTurn: true,
          disabledBid: 3,
        })
      );

      // Turn state cleared, so the next 4th bidder makes a fresh decision...
      const next = onCalculateDisabledBids(
        makeBidContext(
          [makeBid(3), makeBid(4), makeBid(1)],
          afterRound.modState
        )
      );
      // ...which at 0% can never disable anything.
      expect(next.disabledBids).toEqual([]);
    });
  });
});
